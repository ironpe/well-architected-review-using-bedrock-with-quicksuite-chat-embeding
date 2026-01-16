#!/bin/bash
# ========================================
# QuickSuite Chat Agent 환경 설정 스크립트
# ========================================
#
# 이 스크립트는 QuickSuite Chat Agent ID를 Lambda 환경 변수에 설정하고
# CDK를 통해 백엔드를 재배포합니다.
#
# 사전 요구사항:
# - QuickSuite Chat Agent 생성 완료
# - Agent ID 확인 (QuickSight 콘솔에서)
#
# 사용법:
#   ./scripts/setup-quicksuite-env.sh
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
echo -e "${BLUE}QuickSuite Chat Agent 환경 설정${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# AWS 계정 ID 가져오기
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "${YELLOW}📋 현재 AWS 설정:${NC}"
echo "  Account ID: $AWS_ACCOUNT_ID"
echo "  Region: $AWS_REGION"
echo ""

# Agent ID 입력 (필수)
echo -e "${YELLOW}🤖 QuickSuite Chat Agent ID 입력 (필수)${NC}"
echo "  QuickSight 콘솔에서 확인:"
echo "  https://quicksight.aws.amazon.com/ → Chat agents → 생성한 Agent 선택"
echo "  URL에서 Agent ID 확인: .../agents/{AGENT_ID}/"
echo ""
read -p "Agent ID를 입력하세요: " AGENT_ID

if [ -z "$AGENT_ID" ]; then
  echo -e "${RED}❌ Agent ID는 필수입니다. 스크립트를 종료합니다.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Agent ID: $AGENT_ID${NC}"
echo ""

# 사용자 이름 입력 (필수)
echo -e "${YELLOW}👤 QuickSight 사용자 이름 입력 (필수)${NC}"
echo "  형식: {Role}/{Username}"
echo "  예시: Admin/your-username"
echo "  예시: WSParticipantRole/Participant"
echo "  확인 방법: QuickSight 콘솔 → Admin → Manage users"
echo ""
read -p "QuickSight 사용자 이름을 입력하세요: " QUICKSIGHT_USER

if [ -z "$QUICKSIGHT_USER" ]; then
  echo -e "${RED}❌ 사용자 이름은 필수입니다. 스크립트를 종료합니다.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 사용자 이름: $QUICKSIGHT_USER${NC}"
echo ""

# 설정 확인
echo -e "${YELLOW}📝 설정할 환경 변수:${NC}"
echo "  QUICKSIGHT_ACCOUNT_ID: $AWS_ACCOUNT_ID"
echo "  QUICKSIGHT_NAMESPACE: default"
echo "  QUICKSIGHT_AGENT_ID: $AGENT_ID"
echo "  QUICKSIGHT_USER_NAME: $QUICKSIGHT_USER"
echo ""

read -p "계속 진행하시겠습니까? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo -e "${RED}❌ 취소되었습니다.${NC}"
  exit 0
fi

# CDK 스택 파일 업데이트
CDK_FILE="infrastructure/lib/minimal-stack.ts"

if [ ! -f "$CDK_FILE" ]; then
  echo -e "${RED}❌ CDK 스택 파일을 찾을 수 없습니다: $CDK_FILE${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}[1/3] CDK 스택 파일 업데이트 중...${NC}"

# QUICKSIGHT_AGENT_ID 값 업데이트
if grep -q "QUICKSIGHT_AGENT_ID:" "$CDK_FILE"; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|QUICKSIGHT_AGENT_ID: '.*'|QUICKSIGHT_AGENT_ID: '$AGENT_ID'|" "$CDK_FILE"
  else
    sed -i "s|QUICKSIGHT_AGENT_ID: '.*'|QUICKSIGHT_AGENT_ID: '$AGENT_ID'|" "$CDK_FILE"
  fi
  echo -e "${GREEN}✅ QUICKSIGHT_AGENT_ID 업데이트 완료${NC}"
else
  echo -e "${RED}⚠️  QUICKSIGHT_AGENT_ID를 찾을 수 없습니다.${NC}"
fi

# QUICKSIGHT_USER_NAME 값 업데이트
if grep -q "QUICKSIGHT_USER_NAME:" "$CDK_FILE"; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|QUICKSIGHT_USER_NAME: '.*'|QUICKSIGHT_USER_NAME: '$QUICKSIGHT_USER'|" "$CDK_FILE"
  else
    sed -i "s|QUICKSIGHT_USER_NAME: '.*'|QUICKSIGHT_USER_NAME: '$QUICKSIGHT_USER'|" "$CDK_FILE"
  fi
  echo -e "${GREEN}✅ QUICKSIGHT_USER_NAME 업데이트 완료${NC}"
else
  echo -e "${RED}⚠️  QUICKSIGHT_USER_NAME을 찾을 수 없습니다.${NC}"
fi

echo ""
echo -e "${YELLOW}[2/3] Backend 빌드 중...${NC}"

# Backend 빌드
cd backend
npm run build
./package-simple.sh
cd ..

echo -e "${GREEN}✅ Backend 빌드 완료${NC}"

echo ""
echo -e "${YELLOW}[3/3] CDK 배포 중...${NC}"

# CDK 배포
cd infrastructure
npx cdk deploy --require-approval never
cd ..

echo -e "${GREEN}✅ CDK 배포 완료${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}QuickSuite Chat Agent 설정 완료!${NC}"
echo -e "${BLUE}========================================${NC}"

echo ""
echo -e "${YELLOW}📋 설정된 환경 변수 확인:${NC}"

# Lambda 함수 이름 찾기
QUICKSIGHT_LAMBDA=$(aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'QuickSightEmbedFn')].FunctionName" \
  --output text --region $AWS_REGION 2>/dev/null | head -1)

if [ -n "$QUICKSIGHT_LAMBDA" ]; then
  echo "  Lambda 함수: $QUICKSIGHT_LAMBDA"
  echo ""
  aws lambda get-function-configuration \
    --function-name "$QUICKSIGHT_LAMBDA" \
    --query 'Environment.Variables.{AGENT_ID:QUICKSIGHT_AGENT_ID,USER_NAME:QUICKSIGHT_USER_NAME,ACCOUNT_ID:QUICKSIGHT_ACCOUNT_ID}' \
    --region $AWS_REGION
else
  echo -e "${RED}⚠️  QuickSight Lambda 함수를 찾을 수 없습니다.${NC}"
fi

echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo "1. 프론트엔드에서 채팅 버튼 클릭"
echo "2. QuickSuite Chat Agent 테스트"
echo ""
echo -e "자세한 내용은 ${BLUE}README.md${NC}의 QuickSuite MCP 연동 섹션 참조"
