#!/bin/bash
# ========================================
# AgentCore Gateway 설정 스크립트
# ========================================
#
# 이 스크립트는 AgentCore Gateway를 생성하고
# MCP Lambda를 Target으로 등록합니다.
#
# 사전 요구사항:
# - AWS CLI 설치 및 구성 (bedrock-agentcore-control 명령어 포함)
# - CDK 스택 배포 완료
# - Cognito 설정 완료 (setup-agentcore-cognito.sh 실행)
# - jq 설치
#
# 사용법:
#   ./scripts/setup-agentcore-gateway.sh
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
echo -e "${BLUE}AgentCore Gateway 설정${NC}"
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
STACK_NAME=${STACK_NAME:-ArchitectureReviewStack}
GATEWAY_NAME="arch-review-waf-gateway"

echo -e "\n${YELLOW}[1/6] 사전 요구사항 확인 중...${NC}"

# AWS CLI bedrock-agentcore-control 확인
if ! aws bedrock-agentcore-control help &> /dev/null; then
    echo -e "${RED}Error: AWS CLI bedrock-agentcore-control 명령어를 사용할 수 없습니다.${NC}"
    echo "AWS CLI를 최신 버전으로 업데이트하세요: pip install --upgrade awscli"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI bedrock-agentcore-control 확인됨${NC}"

# jq 확인
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq가 설치되지 않았습니다.${NC}"
    echo "설치 방법: brew install jq"
    exit 1
fi
echo -e "${GREEN}✓ jq 확인됨${NC}"

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
    echo "CDK 스택을 먼저 배포하세요: cd infrastructure && npx cdk deploy"
    exit 1
fi
echo -e "${GREEN}✓ MCP Lambda ARN: $MCP_LAMBDA_ARN${NC}"

# Cognito 설정 확인
if [ -z "$COGNITO_USER_POOL_ID" ]; then
    echo -e "${RED}Error: Cognito User Pool ID가 설정되지 않았습니다.${NC}"
    echo "먼저 setup-agentcore-cognito.sh를 실행하세요."
    exit 1
fi
echo -e "${GREEN}✓ Cognito User Pool ID: $COGNITO_USER_POOL_ID${NC}"

if [ -z "$AGENTCORE_CLIENT_ID" ]; then
    echo -e "${RED}Error: AgentCore Client ID가 설정되지 않았습니다.${NC}"
    echo "먼저 setup-agentcore-cognito.sh를 실행하세요."
    exit 1
fi
echo -e "${GREEN}✓ AgentCore Client ID: $AGENTCORE_CLIENT_ID${NC}"

# AWS Account ID 가져오기
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account ID: $AWS_ACCOUNT_ID${NC}"

echo -e "\n${YELLOW}[2/6] Gateway IAM Role 생성 중...${NC}"

GATEWAY_ROLE_NAME="AgentCoreGatewayRole-ArchReview"

# 기존 Role 확인
EXISTING_ROLE=$(aws iam get-role --role-name $GATEWAY_ROLE_NAME 2>/dev/null || echo "")

if [ -z "$EXISTING_ROLE" ]; then
    # Trust policy for Gateway
    TRUST_POLICY='{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": "bedrock-agentcore.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }'

    # Gateway Role 생성
    GATEWAY_ROLE_ARN=$(aws iam create-role \
      --role-name "$GATEWAY_ROLE_NAME" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --description "Role for AgentCore Gateway to invoke Lambda" \
      --query 'Role.Arn' \
      --output text)

    echo -e "${GREEN}✓ Gateway Role 생성됨: $GATEWAY_ROLE_ARN${NC}"

    # Lambda 호출 권한 추가
    aws iam put-role-policy \
      --role-name "$GATEWAY_ROLE_NAME" \
      --policy-name LambdaInvokePolicy \
      --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Action": "lambda:InvokeFunction",
            "Resource": "'$MCP_LAMBDA_ARN'"
          }
        ]
      }'

    echo -e "${GREEN}✓ Lambda 호출 권한 추가됨${NC}"

    # Role이 전파될 때까지 대기
    echo -e "${YELLOW}IAM Role 전파 대기 중 (10초)...${NC}"
    sleep 10
else
    GATEWAY_ROLE_ARN=$(echo "$EXISTING_ROLE" | jq -r '.Role.Arn')
    echo -e "${GREEN}✓ 기존 Gateway Role 사용: $GATEWAY_ROLE_ARN${NC}"
fi

echo -e "\n${YELLOW}[3/6] AgentCore Gateway 생성 중...${NC}"

# Cognito OIDC Discovery URL
DISCOVERY_URL="https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/openid-configuration"

# 기존 Gateway 확인
EXISTING_GATEWAY=$(aws bedrock-agentcore-control list-gateways \
    --region $AWS_REGION \
    --query "gateways[?name=='$GATEWAY_NAME'].gatewayId" \
    --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_GATEWAY" ] || [ "$EXISTING_GATEWAY" == "None" ]; then
    # Gateway 생성
    GATEWAY_OUTPUT=$(aws bedrock-agentcore-control create-gateway \
      --name "$GATEWAY_NAME" \
      --role-arn "$GATEWAY_ROLE_ARN" \
      --protocol-type MCP \
      --authorizer-type CUSTOM_JWT \
      --authorizer-configuration customJWTAuthorizer="{discoveryUrl=$DISCOVERY_URL,allowedClients=[$AGENTCORE_CLIENT_ID]}" \
      --region $AWS_REGION 2>&1)

    if [ $? -eq 0 ]; then
        GATEWAY_ID=$(echo "$GATEWAY_OUTPUT" | jq -r '.gatewayId')
        GATEWAY_URL=$(echo "$GATEWAY_OUTPUT" | jq -r '.gatewayUrl')
        echo -e "${GREEN}✓ Gateway 생성됨: $GATEWAY_ID${NC}"
        echo -e "${GREEN}✓ Gateway URL: $GATEWAY_URL${NC}"
    else
        echo -e "${RED}Gateway 생성 실패:${NC}"
        echo "$GATEWAY_OUTPUT"
        exit 1
    fi
else
    GATEWAY_ID=$EXISTING_GATEWAY
    GATEWAY_INFO=$(aws bedrock-agentcore-control get-gateway \
        --gateway-identifier "$GATEWAY_ID" \
        --region $AWS_REGION 2>/dev/null)
    GATEWAY_URL=$(echo "$GATEWAY_INFO" | jq -r '.gatewayUrl')
    echo -e "${GREEN}✓ 기존 Gateway 사용: $GATEWAY_ID${NC}"
    echo -e "${GREEN}✓ Gateway URL: $GATEWAY_URL${NC}"
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
        aws bedrock-agentcore-control get-gateway \
            --gateway-identifier "$GATEWAY_ID" \
            --region $AWS_REGION \
            --query 'statusReasons' \
            --output text
        exit 1
    fi
    
    echo -e "  Gateway 상태: $GATEWAY_STATUS (대기 중... $i/24)"
    sleep 5
done

echo -e "\n${YELLOW}[5/6] Lambda Target 추가 중...${NC}"

TARGET_NAME="arch-review-waf-tools"

# Target configuration JSON 파일 생성
TARGET_CONFIG_FILE="/tmp/target-config-$$.json"
cat > $TARGET_CONFIG_FILE << EOF
{
  "mcp": {
    "lambda": {
      "lambdaArn": "$MCP_LAMBDA_ARN",
      "toolSchema": {
        "inlinePayload": [
          {
            "name": "list_review_requests",
            "description": "아키텍처 리뷰 요청 목록을 조회합니다. 상태별 필터링이 가능합니다.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "limit": {"type": "number", "description": "조회할 최대 개수 (기본값: 20)"},
                "status": {"type": "string", "description": "리뷰 상태 필터", "enum": ["Pending Review", "In Review", "Modification Required", "Review Completed", "Rejected"]}
              }
            }
          },
          {
            "name": "get_review_request",
            "description": "특정 리뷰 요청의 상세 정보를 조회합니다.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "reviewRequestId": {"type": "string", "description": "리뷰 요청 ID"}
              },
              "required": ["reviewRequestId"]
            }
          },
          {
            "name": "list_documents",
            "description": "업로드된 아키텍처 문서 목록을 조회합니다.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "limit": {"type": "number", "description": "조회할 최대 개수 (기본값: 20)"},
                "reviewRequestId": {"type": "string", "description": "특정 리뷰 요청에 연결된 문서만 조회"}
              }
            }
          },
          {
            "name": "get_document",
            "description": "특정 문서의 상세 정보를 조회합니다.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "documentId": {"type": "string", "description": "문서 ID"},
                "versionNumber": {"type": "number", "description": "문서 버전 번호 (기본값: 1)"}
              },
              "required": ["documentId"]
            }
          },
          {
            "name": "list_review_executions",
            "description": "리뷰 실행 기록 목록을 조회합니다. AI가 수행한 아키텍처 검토 결과들입니다.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "limit": {"type": "number", "description": "조회할 최대 개수 (기본값: 20)"},
                "reviewRequestId": {"type": "string", "description": "특정 리뷰 요청의 실행 기록만 조회"}
              }
            }
          },
          {
            "name": "get_review_execution",
            "description": "특정 리뷰 실행의 상세 결과를 조회합니다. Pillar별 분석 결과, 요약, 권장사항이 포함됩니다.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "executionId": {"type": "string", "description": "실행 ID"}
              },
              "required": ["executionId"]
            }
          },
          {
            "name": "list_pillar_configs",
            "description": "Well-Architected Framework Pillar 설정 목록을 조회합니다.",
            "inputSchema": {
              "type": "object",
              "properties": {}
            }
          },
          {
            "name": "list_governance_policies",
            "description": "거버넌스 정책 목록을 조회합니다. 아키텍처 검토 시 참조되는 기업 정책들입니다.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "limit": {"type": "number", "description": "조회할 최대 개수 (기본값: 20)"}
              }
            }
          }
        ]
      }
    }
  }
}
EOF

# Credential provider configuration 파일 생성
CREDENTIAL_CONFIG_FILE="/tmp/credential-providers-$$.json"
cat > $CREDENTIAL_CONFIG_FILE << 'EOF'
[
  {
    "credentialProviderType": "GATEWAY_IAM_ROLE"
  }
]
EOF

# 기존 Target 확인
EXISTING_TARGET=$(aws bedrock-agentcore-control list-gateway-targets \
    --gateway-identifier "$GATEWAY_ID" \
    --region $AWS_REGION \
    --query "targets[?name=='$TARGET_NAME'].targetId" \
    --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_TARGET" ] || [ "$EXISTING_TARGET" == "None" ]; then
    # Lambda Target 생성
    TARGET_OUTPUT=$(aws bedrock-agentcore-control create-gateway-target \
      --gateway-identifier "$GATEWAY_ID" \
      --name "$TARGET_NAME" \
      --target-configuration file://$TARGET_CONFIG_FILE \
      --credential-provider-configurations file://$CREDENTIAL_CONFIG_FILE \
      --region $AWS_REGION 2>&1)

    if [ $? -eq 0 ]; then
        TARGET_ID=$(echo "$TARGET_OUTPUT" | jq -r '.targetId')
        echo -e "${GREEN}✓ Lambda Target 생성됨: $TARGET_ID${NC}"
    else
        echo -e "${RED}Lambda Target 생성 실패:${NC}"
        echo "$TARGET_OUTPUT"
        rm -f $TARGET_CONFIG_FILE $CREDENTIAL_CONFIG_FILE
        exit 1
    fi
else
    TARGET_ID=$EXISTING_TARGET
    echo -e "${GREEN}✓ 기존 Lambda Target 사용: $TARGET_ID${NC}"
fi

# 임시 파일 삭제
rm -f $TARGET_CONFIG_FILE $CREDENTIAL_CONFIG_FILE

echo -e "\n${YELLOW}[6/6] 설정 정보 저장 중...${NC}"

# Gateway 설정 추가 (기존 내용에 추가)
cat >> infrastructure/.env.agentcore << EOF

# AgentCore Gateway
GATEWAY_NAME=$GATEWAY_NAME
GATEWAY_ID=$GATEWAY_ID
GATEWAY_URL=$GATEWAY_URL
GATEWAY_ROLE_ARN=$GATEWAY_ROLE_ARN
GATEWAY_MCP_URL=${GATEWAY_URL}
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
echo -e "Scopes:        ${GREEN}architecture-review-mcp/read architecture-review-mcp/write${NC}"
echo -e "────────────────────────────────────────"

echo -e "\n${YELLOW}📋 등록될 MCP 도구 (8개):${NC}"
echo "  - list_review_requests"
echo "  - get_review_request"
echo "  - list_documents"
echo "  - get_document"
echo "  - list_review_executions"
echo "  - get_review_execution"
echo "  - list_pillar_configs"
echo "  - list_governance_policies"

echo -e "\n${YELLOW}다음 단계:${NC}"
echo "1. QuickSuite 콘솔에서 MCP Action 등록"
echo "2. Chat Agent에서 도구 테스트"
echo ""
echo -e "자세한 내용은 ${BLUE}docs/QUICKSUITE-MCP-REGISTRATION.md${NC} 참조"
