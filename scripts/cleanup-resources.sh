#!/bin/bash

# ============================================
# Architecture Review System - 리소스 삭제 스크립트
# ============================================
# 이 스크립트는 CDK 스택과 관련 AWS 리소스를 삭제합니다.
# 
# 사용법:
#   ./scripts/cleanup-resources.sh [옵션]
#
# 옵션:
#   --force    확인 없이 바로 삭제
#   --dry-run  삭제할 리소스만 확인 (실제 삭제 안함)
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 스택 이름
STACK_NAME="ArchReview-Minimal"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# 옵션 파싱
FORCE=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
  esac
done

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Architecture Review System 리소스 삭제${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "스택 이름: ${YELLOW}${STACK_NAME}${NC}"
echo -e "리전: ${YELLOW}${REGION}${NC}"
echo ""

# 스택 존재 여부 확인
check_stack_exists() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null
  return $?
}

# 스택 리소스 목록 출력
list_stack_resources() {
  echo -e "${BLUE}스택 리소스 목록:${NC}"
  echo ""
  
  aws cloudformation list-stack-resources \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'StackResourceSummaries[].{Type:ResourceType,LogicalId:LogicalResourceId,Status:ResourceStatus}' \
    --output table 2>/dev/null || echo "스택 리소스를 조회할 수 없습니다."
  
  echo ""
}

# AgentCore Gateway 리소스 삭제 (있는 경우)
cleanup_agentcore_resources() {
  echo -e "${YELLOW}AgentCore Gateway 리소스 확인 중...${NC}"
  
  # .env.agentcore 파일에서 Gateway ID 확인
  if [ -f "infrastructure/.env.agentcore" ]; then
    GATEWAY_ID=$(grep "GATEWAY_ID=" infrastructure/.env.agentcore 2>/dev/null | cut -d= -f2)
    
    if [ -n "$GATEWAY_ID" ]; then
      echo -e "  Gateway ID: ${YELLOW}${GATEWAY_ID}${NC}"
      
      if [ "$DRY_RUN" = true ]; then
        echo -e "  ${BLUE}[DRY-RUN]${NC} Gateway 삭제 예정"
      else
        echo -e "  Gateway 삭제 중..."
        
        # Target 삭제
        TARGETS=$(aws bedrock-agentcore-control list-gateway-targets \
          --gateway-identifier "$GATEWAY_ID" \
          --region "$REGION" \
          --query 'targets[].targetId' \
          --output text 2>/dev/null || echo "")
        
        for TARGET_ID in $TARGETS; do
          echo -e "    Target 삭제: ${TARGET_ID}"
          aws bedrock-agentcore-control delete-gateway-target \
            --gateway-identifier "$GATEWAY_ID" \
            --target-id "$TARGET_ID" \
            --region "$REGION" 2>/dev/null || true
        done
        
        # Gateway 삭제
        aws bedrock-agentcore-control delete-gateway \
          --gateway-identifier "$GATEWAY_ID" \
          --region "$REGION" 2>/dev/null || true
        
        echo -e "  ${GREEN}Gateway 삭제 완료${NC}"
      fi
    fi
  else
    echo -e "  AgentCore Gateway 설정 파일 없음 (건너뜀)"
  fi
  echo ""
}

# Cognito M2M 클라이언트 삭제 (있는 경우)
cleanup_cognito_m2m() {
  echo -e "${YELLOW}Cognito M2M 클라이언트 확인 중...${NC}"
  
  if [ -f "infrastructure/.env.agentcore" ]; then
    USER_POOL_ID=$(grep "COGNITO_USER_POOL_ID=" infrastructure/.env.agentcore 2>/dev/null | cut -d= -f2)
    CLIENT_ID=$(grep "AGENTCORE_CLIENT_ID=" infrastructure/.env.agentcore 2>/dev/null | cut -d= -f2)
    
    if [ -n "$USER_POOL_ID" ] && [ -n "$CLIENT_ID" ]; then
      echo -e "  User Pool ID: ${YELLOW}${USER_POOL_ID}${NC}"
      echo -e "  Client ID: ${YELLOW}${CLIENT_ID}${NC}"
      
      if [ "$DRY_RUN" = true ]; then
        echo -e "  ${BLUE}[DRY-RUN]${NC} M2M 클라이언트 삭제 예정"
      else
        echo -e "  M2M 클라이언트 삭제 중..."
        aws cognito-idp delete-user-pool-client \
          --user-pool-id "$USER_POOL_ID" \
          --client-id "$CLIENT_ID" \
          --region "$REGION" 2>/dev/null || true
        echo -e "  ${GREEN}M2M 클라이언트 삭제 완료${NC}"
      fi
    fi
    
    # Resource Server 삭제
    RESOURCE_SERVER_ID=$(grep "RESOURCE_SERVER_ID=" infrastructure/.env.agentcore 2>/dev/null | cut -d= -f2)
    if [ -n "$USER_POOL_ID" ] && [ -n "$RESOURCE_SERVER_ID" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "  ${BLUE}[DRY-RUN]${NC} Resource Server 삭제 예정"
      else
        echo -e "  Resource Server 삭제 중..."
        aws cognito-idp delete-resource-server \
          --user-pool-id "$USER_POOL_ID" \
          --identifier "$RESOURCE_SERVER_ID" \
          --region "$REGION" 2>/dev/null || true
        echo -e "  ${GREEN}Resource Server 삭제 완료${NC}"
      fi
    fi
  else
    echo -e "  Cognito M2M 설정 파일 없음 (건너뜀)"
  fi
  echo ""
}

# CDK 스택 삭제
delete_cdk_stack() {
  echo -e "${YELLOW}CDK 스택 삭제 중...${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}[DRY-RUN]${NC} 다음 명령이 실행됩니다:"
    echo -e "  cd infrastructure && npx cdk destroy ${STACK_NAME} --force"
  else
    cd infrastructure
    npx cdk destroy "$STACK_NAME" --force
    cd ..
    echo -e "${GREEN}CDK 스택 삭제 완료${NC}"
  fi
  echo ""
}

# 환경 설정 파일 정리
cleanup_env_files() {
  echo -e "${YELLOW}환경 설정 파일 정리...${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}[DRY-RUN]${NC} 다음 파일이 삭제됩니다:"
    [ -f "infrastructure/.env.agentcore" ] && echo "  - infrastructure/.env.agentcore"
    [ -f "frontend/.env" ] && echo "  - frontend/.env (배포 관련 값만 초기화)"
  else
    # AgentCore 설정 파일 삭제
    if [ -f "infrastructure/.env.agentcore" ]; then
      rm -f infrastructure/.env.agentcore
      echo -e "  ${GREEN}infrastructure/.env.agentcore 삭제됨${NC}"
    fi
    
    echo -e "  ${YELLOW}참고: frontend/.env는 수동으로 확인하세요${NC}"
  fi
  echo ""
}

# 메인 실행
main() {
  # 스택 존재 확인
  if ! check_stack_exists; then
    echo -e "${YELLOW}스택 '${STACK_NAME}'이 존재하지 않습니다.${NC}"
    echo ""
    
    # 환경 파일만 정리
    cleanup_env_files
    
    echo -e "${GREEN}정리 완료!${NC}"
    exit 0
  fi
  
  # 리소스 목록 출력
  list_stack_resources
  
  # 확인 프롬프트 (--force가 아닌 경우)
  if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
    echo -e "${RED}⚠️  경고: 이 작업은 되돌릴 수 없습니다!${NC}"
    echo -e "${RED}모든 데이터(DynamoDB, S3)가 삭제됩니다.${NC}"
    echo ""
    read -p "정말 삭제하시겠습니까? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
      echo -e "${YELLOW}삭제가 취소되었습니다.${NC}"
      exit 0
    fi
    echo ""
  fi
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}[DRY-RUN 모드] 실제 삭제는 수행되지 않습니다${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
  fi
  
  # 리소스 삭제 순서
  # 1. AgentCore Gateway (CDK 외부 리소스)
  cleanup_agentcore_resources
  
  # 2. Cognito M2M 클라이언트 (CDK 외부 리소스)
  cleanup_cognito_m2m
  
  # 3. CDK 스택 삭제 (S3, DynamoDB, Lambda, API Gateway 등)
  delete_cdk_stack
  
  # 4. 환경 설정 파일 정리
  cleanup_env_files
  
  echo -e "${GREEN}============================================${NC}"
  if [ "$DRY_RUN" = true ]; then
    echo -e "${GREEN}[DRY-RUN] 삭제 예정 리소스 확인 완료${NC}"
    echo -e "${YELLOW}실제 삭제를 수행하려면 --dry-run 옵션을 제거하세요${NC}"
  else
    echo -e "${GREEN}모든 리소스가 성공적으로 삭제되었습니다!${NC}"
  fi
  echo -e "${GREEN}============================================${NC}"
}

# 스크립트 실행
main
