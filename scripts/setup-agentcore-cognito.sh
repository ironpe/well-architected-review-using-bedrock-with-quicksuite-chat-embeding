#!/bin/bash
# ========================================
# AgentCore Gateway용 Cognito 설정 스크립트
# ========================================
# 
# 이 스크립트는 AgentCore Gateway가 MCP Lambda를 호출할 때
# 사용할 Cognito M2M (Machine-to-Machine) 인증을 설정합니다.
#
# 사전 요구사항:
# - AWS CLI 설치 및 구성
# - CDK 스택 배포 완료 (UserPool 생성됨)
# - jq 설치 (JSON 파싱용)
#
# 사용법:
#   ./scripts/setup-agentcore-cognito.sh
#
# ========================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AgentCore Gateway Cognito 설정${NC}"
echo -e "${BLUE}========================================${NC}"

# 환경 변수 로드
if [ -f "infrastructure/.env" ]; then
    source infrastructure/.env
fi

if [ -f "frontend/.env" ]; then
    # frontend/.env에서 Cognito 정보 추출
    export COGNITO_USER_POOL_ID=$(grep VITE_COGNITO_USER_POOL_ID frontend/.env | cut -d'=' -f2)
    export COGNITO_REGION=$(grep VITE_COGNITO_REGION frontend/.env | cut -d'=' -f2)
fi

# AWS 리전 설정
AWS_REGION=${COGNITO_REGION:-${AWS_REGION:-us-east-1}}
STACK_NAME=${STACK_NAME:-ArchReview-Minimal}

echo -e "\n${YELLOW}[1/6] Cognito User Pool 정보 조회 중...${NC}"

# frontend/.env에서 User Pool ID 가져오기 (우선)
USER_POOL_ID=${COGNITO_USER_POOL_ID:-""}

# 없으면 CloudFormation에서 조회 시도
if [ -z "$USER_POOL_ID" ]; then
    USER_POOL_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
        --output text 2>/dev/null)
fi

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" == "None" ]; then
    echo -e "${RED}Error: User Pool ID를 찾을 수 없습니다.${NC}"
    echo "CDK 스택이 배포되었는지 확인하세요: cd infrastructure && npx cdk deploy"
    exit 1
fi

echo -e "${GREEN}✓ User Pool ID: $USER_POOL_ID${NC}"

# MCP Lambda ARN 가져오기
MCP_LAMBDA_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query "Stacks[0].Outputs[?OutputKey=='McpServerFunctionArn'].OutputValue" \
    --output text 2>/dev/null || echo "")

if [ -z "$MCP_LAMBDA_ARN" ] || [ "$MCP_LAMBDA_ARN" == "None" ]; then
    # 대체: Lambda 함수 직접 조회
    MCP_LAMBDA_ARN=$(aws lambda list-functions \
        --region $AWS_REGION \
        --query "Functions[?contains(FunctionName, 'McpServer')].FunctionArn" \
        --output text 2>/dev/null | head -1 || echo "")
fi

if [ -z "$MCP_LAMBDA_ARN" ] || [ "$MCP_LAMBDA_ARN" == "None" ]; then
    echo -e "${YELLOW}Warning: MCP Lambda ARN을 찾을 수 없습니다. CDK 재배포가 필요할 수 있습니다.${NC}"
    echo -e "${YELLOW}계속 진행합니다 (나중에 수동으로 설정 가능)${NC}"
    MCP_LAMBDA_ARN="<MCP_LAMBDA_ARN_PLACEHOLDER>"
else
    echo -e "${GREEN}✓ MCP Lambda ARN: $MCP_LAMBDA_ARN${NC}"
fi

echo -e "\n${YELLOW}[2/6] User Pool Domain 설정 중...${NC}"

# 도메인 이름 생성 (고유해야 함)
DOMAIN_PREFIX="arch-review-agentcore-$(echo $USER_POOL_ID | cut -d'_' -f2 | tr '[:upper:]' '[:lower:]')"

# 기존 도메인 확인
EXISTING_DOMAIN=$(aws cognito-idp describe-user-pool \
    --user-pool-id $USER_POOL_ID \
    --region $AWS_REGION \
    --query "UserPool.Domain" \
    --output text 2>/dev/null)

if [ -z "$EXISTING_DOMAIN" ] || [ "$EXISTING_DOMAIN" == "None" ]; then
    # 도메인 생성
    aws cognito-idp create-user-pool-domain \
        --user-pool-id $USER_POOL_ID \
        --domain $DOMAIN_PREFIX \
        --region $AWS_REGION 2>/dev/null || {
            # 도메인이 이미 사용 중인 경우 타임스탬프 추가
            DOMAIN_PREFIX="${DOMAIN_PREFIX}-$(date +%s)"
            aws cognito-idp create-user-pool-domain \
                --user-pool-id $USER_POOL_ID \
                --domain $DOMAIN_PREFIX \
                --region $AWS_REGION
        }
    echo -e "${GREEN}✓ Domain 생성됨: $DOMAIN_PREFIX${NC}"
else
    DOMAIN_PREFIX=$EXISTING_DOMAIN
    echo -e "${GREEN}✓ 기존 Domain 사용: $DOMAIN_PREFIX${NC}"
fi

TOKEN_URL="https://${DOMAIN_PREFIX}.auth.${AWS_REGION}.amazoncognito.com/oauth2/token"

echo -e "\n${YELLOW}[3/6] Resource Server 생성 중...${NC}"

RESOURCE_SERVER_ID="architecture-review-mcp"

# Resource Server 존재 여부 확인
EXISTING_RS=$(aws cognito-idp describe-resource-server \
    --user-pool-id $USER_POOL_ID \
    --identifier $RESOURCE_SERVER_ID \
    --region $AWS_REGION 2>/dev/null || echo "")

if [ -z "$EXISTING_RS" ]; then
    # Resource Server 생성
    aws cognito-idp create-resource-server \
        --user-pool-id $USER_POOL_ID \
        --identifier $RESOURCE_SERVER_ID \
        --name "Architecture Review MCP API" \
        --scopes ScopeName=read,ScopeDescription="Read access to review data" \
                 ScopeName=write,ScopeDescription="Write access to review data" \
        --region $AWS_REGION
    echo -e "${GREEN}✓ Resource Server 생성됨${NC}"
else
    echo -e "${GREEN}✓ 기존 Resource Server 사용${NC}"
fi

echo -e "\n${YELLOW}[4/6] M2M App Client 생성 중...${NC}"

CLIENT_NAME="AgentCore-MCP-Client"

# 기존 클라이언트 확인
EXISTING_CLIENT=$(aws cognito-idp list-user-pool-clients \
    --user-pool-id $USER_POOL_ID \
    --region $AWS_REGION \
    --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId" \
    --output text 2>/dev/null)

if [ -z "$EXISTING_CLIENT" ] || [ "$EXISTING_CLIENT" == "None" ]; then
    # M2M App Client 생성 (Client Credentials Flow)
    CLIENT_RESULT=$(aws cognito-idp create-user-pool-client \
        --user-pool-id $USER_POOL_ID \
        --client-name $CLIENT_NAME \
        --generate-secret \
        --allowed-o-auth-flows "client_credentials" \
        --allowed-o-auth-scopes "${RESOURCE_SERVER_ID}/read" "${RESOURCE_SERVER_ID}/write" \
        --allowed-o-auth-flows-user-pool-client \
        --supported-identity-providers "COGNITO" \
        --region $AWS_REGION \
        --output json)
    
    CLIENT_ID=$(echo $CLIENT_RESULT | jq -r '.UserPoolClient.ClientId')
    CLIENT_SECRET=$(echo $CLIENT_RESULT | jq -r '.UserPoolClient.ClientSecret')
    echo -e "${GREEN}✓ M2M App Client 생성됨${NC}"
else
    CLIENT_ID=$EXISTING_CLIENT
    # 기존 클라이언트의 Secret 조회
    CLIENT_RESULT=$(aws cognito-idp describe-user-pool-client \
        --user-pool-id $USER_POOL_ID \
        --client-id $CLIENT_ID \
        --region $AWS_REGION \
        --output json)
    CLIENT_SECRET=$(echo $CLIENT_RESULT | jq -r '.UserPoolClient.ClientSecret')
    echo -e "${GREEN}✓ 기존 M2M App Client 사용: $CLIENT_ID${NC}"
fi

echo -e "\n${YELLOW}[5/6] 설정 정보 저장 중...${NC}"

# 설정 파일 생성
CONFIG_FILE="infrastructure/.env.agentcore"
cat > $CONFIG_FILE << EOF
# AgentCore Gateway Cognito 설정
# 생성일: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Cognito User Pool
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_USER_POOL_ARN=arn:aws:cognito-idp:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):userpool/${USER_POOL_ID}

# Cognito Domain
COGNITO_DOMAIN=$DOMAIN_PREFIX
COGNITO_TOKEN_URL=$TOKEN_URL

# M2M App Client (AgentCore용)
AGENTCORE_CLIENT_ID=$CLIENT_ID
AGENTCORE_CLIENT_SECRET=$CLIENT_SECRET

# Resource Server
RESOURCE_SERVER_ID=$RESOURCE_SERVER_ID
OAUTH_SCOPES=${RESOURCE_SERVER_ID}/read,${RESOURCE_SERVER_ID}/write

# MCP Lambda
MCP_LAMBDA_ARN=$MCP_LAMBDA_ARN

# AWS Region
AWS_REGION=$AWS_REGION
EOF

chmod 600 $CONFIG_FILE
echo -e "${GREEN}✓ 설정 저장됨: $CONFIG_FILE${NC}"

# .gitignore에 추가
if ! grep -q ".env.agentcore" .gitignore 2>/dev/null; then
    echo "infrastructure/.env.agentcore" >> .gitignore
    echo -e "${GREEN}✓ .gitignore 업데이트됨${NC}"
fi

echo -e "\n${YELLOW}[6/6] 토큰 발급 테스트 중...${NC}"

# 토큰 발급 테스트
TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "scope=${RESOURCE_SERVER_ID}/read ${RESOURCE_SERVER_ID}/write")

if echo "$TOKEN_RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 토큰 발급 테스트 성공!${NC}"
else
    echo -e "${YELLOW}⚠ 토큰 발급 테스트 실패 (도메인 전파 대기 필요할 수 있음)${NC}"
    echo "응답: $TOKEN_RESPONSE"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}설정 완료!${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}📋 QuickSuite MCP Action 등록 정보:${NC}"
echo -e "────────────────────────────────────────"
echo -e "Name:          ${GREEN}Architecture Review Data MCP${NC}"
echo -e "Auth Type:     ${GREEN}Service authentication (2LO)${NC}"
echo -e "Client ID:     ${GREEN}$CLIENT_ID${NC}"
echo -e "Client Secret: ${GREEN}$CLIENT_SECRET${NC}"
echo -e "Token URL:     ${GREEN}$TOKEN_URL${NC}"
echo -e "Scopes:        ${GREEN}${RESOURCE_SERVER_ID}/read ${RESOURCE_SERVER_ID}/write${NC}"
echo -e "────────────────────────────────────────"

echo -e "\n${YELLOW}📋 AgentCore Gateway 설정 정보:${NC}"
echo -e "────────────────────────────────────────"
echo -e "MCP Lambda ARN:    ${GREEN}$MCP_LAMBDA_ARN${NC}"
echo -e "User Pool ID:      ${GREEN}$USER_POOL_ID${NC}"
echo -e "User Pool ARN:     ${GREEN}arn:aws:cognito-idp:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):userpool/${USER_POOL_ID}${NC}"
echo -e "────────────────────────────────────────"

echo -e "\n${YELLOW}다음 단계:${NC}"
echo "1. AWS 콘솔에서 AgentCore Gateway 생성"
echo "2. Inbound Auth: Cognito JWT 설정"
echo "3. Lambda Target: MCP Lambda 연결"
echo "4. QuickSuite에서 MCP Action 등록"
echo ""
echo -e "자세한 내용은 ${BLUE}docs/MCP-LAMBDA-SETUP-PLAN.md${NC} 참조"
