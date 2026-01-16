#!/bin/bash
# ========================================
# AgentCore Gateway 설정 스크립트 v2
# ========================================
# 
# 개선사항:
# - Tool Schema를 별도 JSON 파일로 분리
# - 출력 간소화
# - 에러 처리 개선
#
# ========================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AgentCore Gateway 설정 v2${NC}"
echo -e "${BLUE}========================================${NC}"

# 환경 변수 로드
if [ -f "infrastructure/.env" ]; then
    source infrastructure/.env
fi

if [ -f "infrastructure/.env.agentcore" ]; then
    source infrastructure/.env.agentcore
fi

# 설정
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME=${STACK_NAME:-ArchReview-Minimal}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
GATEWAY_NAME="arch-review-waf-gateway-${TIMESTAMP}"
TOOLS_SCHEMA_FILE="scripts/mcp-tools-schema.json"

echo -e "\n${YELLOW}[1/6] 사전 요구사항 확인 중...${NC}"

# AWS CLI bedrock-agentcore-control 확인
if ! aws bedrock-agentcore-control list-gateways --region $AWS_REGION &> /dev/null; then
    echo -e "${RED}Error: AWS CLI bedrock-agentcore-control 명령어를 사용할 수 없습니다.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI bedrock-agentcore-control 확인됨${NC}"

# jq 확인
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq가 설치되지 않았습니다.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ jq 확인됨${NC}"

# Tool Schema 파일 확인
if [ ! -f "$TOOLS_SCHEMA_FILE" ]; then
    echo -e "${RED}Error: Tool Schema 파일을 찾을 수 없습니다: $TOOLS_SCHEMA_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tool Schema 파일 확인됨${NC}"

# MCP Lambda ARN 확인
if [ -z "$MCP_LAMBDA_ARN" ]; then
    MCP_LAMBDA_ARN=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query "Stacks[0].Outputs[?OutputKey=='McpServerFunctionArn'].OutputValue" \
        --output text 2>/dev/null)
fi

if [ -z "$MCP_LAMBDA_ARN" ] || [ "$MCP_LAMBDA_ARN" == "None" ]; then
    echo -e "${RED}Error: MCP Lambda ARN을 찾을 수 없습니다.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ MCP Lambda ARN: $MCP_LAMBDA_ARN${NC}"

# Cognito 설정 확인
if [ -z "$COGNITO_USER_POOL_ID" ]; then
    echo -e "${RED}Error: Cognito User Pool ID가 설정되지 않았습니다.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Cognito User Pool ID: $COGNITO_USER_POOL_ID${NC}"

if [ -z "$AGENTCORE_CLIENT_ID" ]; then
    echo -e "${RED}Error: AgentCore Client ID가 설정되지 않았습니다.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AgentCore Client ID: $AGENTCORE_CLIENT_ID${NC}"

# AWS Account ID 가져오기
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account ID: $AWS_ACCOUNT_ID${NC}"

echo -e "\n${YELLOW}[2/6] Gateway IAM Role 확인 중...${NC}"

GATEWAY_ROLE_NAME="AgentCoreGatewayRole-ArchReview"
GATEWAY_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${GATEWAY_ROLE_NAME}"

# Role 존재 확인
if aws iam get-role --role-name $GATEWAY_ROLE_NAME &> /dev/null; then
    echo -e "${GREEN}✓ Gateway Role 존재: $GATEWAY_ROLE_ARN${NC}"
else
    echo -e "${RED}Error: Gateway Role이 존재하지 않습니다.${NC}"
    echo "먼저 setup-agentcore-cognito.sh를 실행하세요."
    exit 1
fi

echo -e "\n${YELLOW}[3/6] AgentCore Gateway 생성 중...${NC}"

# Cognito OIDC Discovery URL
DISCOVERY_URL="https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/openid-configuration"

# Gateway 생성
GATEWAY_OUTPUT=$(aws bedrock-agentcore-control create-gateway \
  --name "$GATEWAY_NAME" \
  --role-arn "$GATEWAY_ROLE_ARN" \
  --protocol-type MCP \
  --authorizer-type CUSTOM_JWT \
  --authorizer-configuration customJWTAuthorizer="{discoveryUrl=$DISCOVERY_URL,allowedClients=[$AGENTCORE_CLIENT_ID]}" \
  --region $AWS_REGION \
  --query '{gatewayId: gatewayId, gatewayUrl: gatewayUrl}' \
  --output json 2>&1)

if [ $? -eq 0 ]; then
    GATEWAY_ID=$(echo "$GATEWAY_OUTPUT" | jq -r '.gatewayId')
    GATEWAY_URL=$(echo "$GATEWAY_OUTPUT" | jq -r '.gatewayUrl')
    echo -e "${GREEN}✓ Gateway 생성됨: $GATEWAY_ID${NC}"
else
    echo -e "${RED}Gateway 생성 실패:${NC}"
    echo "$GATEWAY_OUTPUT"
    exit 1
fi

echo -e "\n${YELLOW}[4/6] Gateway 상태 확인 중...${NC}"

# Gateway가 READY 상태가 될 때까지 대기
for i in {1..24}; do
    GATEWAY_STATUS=$(aws bedrock-agentcore-control get-gateway \
        --gateway-identifier "$GATEWAY_ID" \
        --region $AWS_REGION \
        --query 'status' \
        --output text 2>/dev/null)
    
    if [ "$GATEWAY_STATUS" = "READY" ]; then
        echo -e "${GREEN}✓ Gateway 상태: READY${NC}"
        break
    elif [ "$GATEWAY_STATUS" = "FAILED" ]; then
        echo -e "${RED}Gateway 생성 실패${NC}"
        exit 1
    fi
    
    echo -e "  Gateway 상태: $GATEWAY_STATUS (대기 중... $i/24)"
    sleep 5
done

echo -e "\n${YELLOW}[5/6] Lambda Target 추가 중...${NC}"

TARGET_NAME="arch-review-waf-tools"

# Target configuration JSON 파일 생성 (별도 파일 사용)
TARGET_CONFIG_FILE="/tmp/target-config-$$.json"
TOOLS_SCHEMA=$(cat "$TOOLS_SCHEMA_FILE")
cat > $TARGET_CONFIG_FILE << TARGETEOF
{
  "mcp": {
    "lambda": {
      "lambdaArn": "$MCP_LAMBDA_ARN",
      "toolSchema": {
        "inlinePayload": $TOOLS_SCHEMA
      }
    }
  }
}
TARGETEOF

# Credential provider configuration 파일 생성
CREDENTIAL_CONFIG_FILE="/tmp/credential-providers-$$.json"
cat > $CREDENTIAL_CONFIG_FILE << 'CREDEOF'
[
  {
    "credentialProviderType": "GATEWAY_IAM_ROLE"
  }
]
CREDEOF

# Lambda Target 생성
TARGET_OUTPUT=$(aws bedrock-agentcore-control create-gateway-target \
  --gateway-identifier "$GATEWAY_ID" \
  --name "$TARGET_NAME" \
  --target-configuration file://$TARGET_CONFIG_FILE \
  --credential-provider-configurations file://$CREDENTIAL_CONFIG_FILE \
  --region $AWS_REGION \
  --query '{targetId: targetId, status: status}' \
  --output json 2>&1)

if [ $? -eq 0 ]; then
    TARGET_ID=$(echo "$TARGET_OUTPUT" | jq -r '.targetId')
    echo -e "${GREEN}✓ Lambda Target 생성됨: $TARGET_ID${NC}"
else
    echo -e "${RED}Lambda Target 생성 실패:${NC}"
    echo "$TARGET_OUTPUT"
    rm -f $TARGET_CONFIG_FILE $CREDENTIAL_CONFIG_FILE
    exit 1
fi

# 임시 파일 삭제
rm -f $TARGET_CONFIG_FILE $CREDENTIAL_CONFIG_FILE

echo -e "\n${YELLOW}[5.5/6] Lambda 호출 권한 추가 중...${NC}"

# Gateway ARN 생성
GATEWAY_ARN="arn:aws:bedrock-agentcore:${AWS_REGION}:${AWS_ACCOUNT_ID}:gateway/${GATEWAY_ID}"

# Lambda에 Gateway 호출 권한 추가
STATEMENT_ID="AllowAgentCoreGateway-$(date +%s)"
aws lambda add-permission \
  --function-name "$MCP_LAMBDA_ARN" \
  --statement-id "$STATEMENT_ID" \
  --action "lambda:InvokeFunction" \
  --principal "bedrock.amazonaws.com" \
  --source-arn "$GATEWAY_ARN" \
  --region $AWS_REGION \
  --output text > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Lambda 호출 권한 추가됨${NC}"
else
    echo -e "${YELLOW}⚠️  Lambda 권한 추가 실패 (이미 존재할 수 있음)${NC}"
fi

echo -e "\n${YELLOW}[6/6] 설정 정보 저장 중...${NC}"

# Gateway 설정 추가
cat >> infrastructure/.env.agentcore << EOF

# AgentCore Gateway ($(date +%Y-%m-%d))
GATEWAY_NAME=$GATEWAY_NAME
GATEWAY_ID=$GATEWAY_ID
GATEWAY_URL=$GATEWAY_URL
GATEWAY_ROLE_ARN=$GATEWAY_ROLE_ARN
GATEWAY_TARGET_NAME=$TARGET_NAME
GATEWAY_TARGET_ID=$TARGET_ID
EOF

echo -e "${GREEN}✓ Gateway 설정 저장됨${NC}"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}AgentCore Gateway 설정 완료!${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}📋 Gateway 정보:${NC}"
echo -e "────────────────────────────────────────"
echo -e "Gateway Name:   ${GREEN}$GATEWAY_NAME${NC}"
echo -e "Gateway ID:     ${GREEN}$GATEWAY_ID${NC}"
echo -e "Gateway URL:    ${GREEN}$GATEWAY_URL${NC}"
echo -e "Target Name:    ${GREEN}$TARGET_NAME${NC}"
echo -e "Target ID:      ${GREEN}$TARGET_ID${NC}"
echo -e "────────────────────────────────────────"

echo -e "\n${YELLOW}📋 QuickSuite MCP Action 등록 정보:${NC}"
echo -e "────────────────────────────────────────"
echo -e "Name:          ${GREEN}Architecture Review Data MCP${NC}"
echo -e "URL:           ${GREEN}${GATEWAY_URL}${NC}"
echo -e "Auth Type:     ${GREEN}Service authentication (2LO)${NC}"
echo -e "Client ID:     ${GREEN}${AGENTCORE_CLIENT_ID}${NC}"
echo -e "Client Secret: ${GREEN}${AGENTCORE_CLIENT_SECRET}${NC}"
echo -e "Token URL:     ${GREEN}${COGNITO_TOKEN_URL}${NC}"
echo -e "────────────────────────────────────────"

echo -e "\n${YELLOW}다음 단계:${NC}"
echo "1. QuickSuite 콘솔에서 MCP Action 등록"
echo "2. Chat Agent에서 도구 테스트"
echo ""
echo -e "자세한 내용은 ${BLUE}docs/QUICKSUITE-MCP-REGISTRATION.md${NC} 참조"
