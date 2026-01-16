#!/bin/bash
# ========================================
# Cognito 사용자 생성 스크립트
# ========================================
#
# 이 스크립트는 Cognito User Pool에 테스트 사용자를 생성합니다.
# - Requester (리뷰 요청자)
# - Reviewer (리뷰 검토자)
#
# 사용법:
#   ./scripts/setup-cognito-users.sh
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
echo -e "${BLUE}Cognito 사용자 생성${NC}"
echo -e "${BLUE}========================================${NC}"

# AWS Region
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "\n${YELLOW}[1/3] User Pool ID 조회 중...${NC}"

# User Pool ID 조회
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ArchReview-Minimal \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolIdOutput`].OutputValue' \
  --output text \
  --region $AWS_REGION 2>/dev/null)

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" == "None" ]; then
  echo -e "${RED}Error: User Pool ID를 찾을 수 없습니다.${NC}"
  echo "먼저 CDK 스택을 배포하세요: cd infrastructure && npx cdk deploy"
  exit 1
fi

echo -e "${GREEN}✓ User Pool ID: $USER_POOL_ID${NC}"

echo -e "\n${YELLOW}[2/3] Requester 사용자 생성 중...${NC}"

# Requester 사용자 생성
REQUESTER_EMAIL="requester@example.com"
REQUESTER_PASSWORD="Requester123!"

echo -e "  이메일: ${REQUESTER_EMAIL}"
echo -e "  비밀번호: ${REQUESTER_PASSWORD}"

# 사용자 생성
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $REQUESTER_EMAIL \
  --user-attributes Name=email,Value=$REQUESTER_EMAIL Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region $AWS_REGION > /dev/null 2>&1 || echo -e "${YELLOW}  (이미 존재할 수 있음)${NC}"

# 비밀번호 설정
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $REQUESTER_EMAIL \
  --password $REQUESTER_PASSWORD \
  --permanent \
  --region $AWS_REGION > /dev/null 2>&1

# 그룹 추가
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username $REQUESTER_EMAIL \
  --group-name Requester_Group \
  --region $AWS_REGION > /dev/null 2>&1

echo -e "${GREEN}✓ Requester 사용자 생성 완료${NC}"

echo -e "\n${YELLOW}[3/3] Reviewer 사용자 생성 중...${NC}"

# Reviewer 사용자 생성
REVIEWER_EMAIL="reviewer@example.com"
REVIEWER_PASSWORD="Reviewer123!"

echo -e "  이메일: ${REVIEWER_EMAIL}"
echo -e "  비밀번호: ${REVIEWER_PASSWORD}"

# 사용자 생성
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $REVIEWER_EMAIL \
  --user-attributes Name=email,Value=$REVIEWER_EMAIL Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region $AWS_REGION > /dev/null 2>&1 || echo -e "${YELLOW}  (이미 존재할 수 있음)${NC}"

# 비밀번호 설정
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $REVIEWER_EMAIL \
  --password $REVIEWER_PASSWORD \
  --permanent \
  --region $AWS_REGION > /dev/null 2>&1

# 그룹 추가
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username $REVIEWER_EMAIL \
  --group-name Reviewer_Group \
  --region $AWS_REGION > /dev/null 2>&1

echo -e "${GREEN}✓ Reviewer 사용자 생성 완료${NC}"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}사용자 생성 완료!${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}📋 생성된 테스트 계정:${NC}"
echo -e "────────────────────────────────────────"
echo -e "Requester (리뷰 요청자):"
echo -e "  이메일: ${GREEN}$REQUESTER_EMAIL${NC}"
echo -e "  비밀번호: ${GREEN}$REQUESTER_PASSWORD${NC}"
echo -e "  그룹: Requester_Group"
echo -e ""
echo -e "Reviewer (리뷰 검토자):"
echo -e "  이메일: ${GREEN}$REVIEWER_EMAIL${NC}"
echo -e "  비밀번호: ${GREEN}$REVIEWER_PASSWORD${NC}"
echo -e "  그룹: Reviewer_Group"
echo -e "────────────────────────────────────────"

echo -e "\n${YELLOW}다음 단계:${NC}"
echo "1. 프론트엔드 접속: http://localhost:3000"
echo "2. 위 계정으로 로그인"
echo "3. 아키텍처 리뷰 시작"
