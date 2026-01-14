#!/bin/bash

# QuickSight 환경 변수 설정 스크립트
# 사용법: ./scripts/setup-quicksight-env.sh

set -e

echo "🚀 QuickSight 환경 변수 설정"
echo "================================"
echo ""

# AWS 계정 ID 가져오기
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo "📋 현재 AWS 설정:"
echo "  Account ID: $AWS_ACCOUNT_ID"
echo "  Region: $AWS_REGION"
echo ""

# Agent ID 입력 (필수)
echo "🤖 QuickSight Chat Agent ID 입력 (필수)"
echo "  QuickSight 콘솔에서 확인:"
echo "  https://quicksight.aws.amazon.com/ → Chat agents → Embed → Agent ID 복사"
echo ""
read -p "Agent ID를 입력하세요: " AGENT_ID

if [ -z "$AGENT_ID" ]; then
  echo "❌ Agent ID는 필수입니다. 스크립트를 종료합니다."
  exit 1
fi

echo "✅ Agent ID: $AGENT_ID"
echo ""

# 사용자 이름 입력 (필수)
echo "👤 QuickSight 사용자 이름 입력 (필수)"
echo "  예시: WSParticipantRole/Participant"
echo "  예시: Admin/your-username"
echo "  확인 방법: QuickSight 콘솔 → Admin → Manage users"
echo ""
read -p "QuickSight 사용자 이름을 입력하세요: " QUICKSIGHT_USER

if [ -z "$QUICKSIGHT_USER" ]; then
  echo "❌ 사용자 이름은 필수입니다. 스크립트를 종료합니다."
  exit 1
fi

echo "✅ 사용자 이름: $QUICKSIGHT_USER"
echo ""

# 설정 확인
echo "📝 설정할 환경 변수:"
echo "  QUICKSIGHT_ACCOUNT_ID: $AWS_ACCOUNT_ID"
echo "  QUICKSIGHT_NAMESPACE: default"
echo "  QUICKSIGHT_AGENT_ID: $AGENT_ID"
echo "  QUICKSIGHT_USER_NAME: $QUICKSIGHT_USER"
echo ""

read -p "계속 진행하시겠습니까? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "❌ 취소되었습니다."
  exit 0
fi

# CDK 스택 파일 업데이트
CDK_FILE="../infrastructure/lib/minimal-stack.ts"

if [ ! -f "$CDK_FILE" ]; then
  echo "❌ CDK 스택 파일을 찾을 수 없습니다: $CDK_FILE"
  exit 1
fi

echo ""
echo "🔧 CDK 스택 파일 업데이트 중..."

# QUICKSIGHT_AGENT_ID 값 업데이트
if grep -q "QUICKSIGHT_AGENT_ID:" "$CDK_FILE"; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|QUICKSIGHT_AGENT_ID: '.*'|QUICKSIGHT_AGENT_ID: '$AGENT_ID'|" "$CDK_FILE"
  else
    sed -i "s|QUICKSIGHT_AGENT_ID: '.*'|QUICKSIGHT_AGENT_ID: '$AGENT_ID'|" "$CDK_FILE"
  fi
  echo "✅ QUICKSIGHT_AGENT_ID 업데이트 완료"
else
  echo "⚠️  QUICKSIGHT_AGENT_ID를 찾을 수 없습니다."
fi

# QUICKSIGHT_USER_NAME 값 업데이트
if grep -q "QUICKSIGHT_USER_NAME:" "$CDK_FILE"; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|QUICKSIGHT_USER_NAME: '.*'|QUICKSIGHT_USER_NAME: '$QUICKSIGHT_USER'|" "$CDK_FILE"
  else
    sed -i "s|QUICKSIGHT_USER_NAME: '.*'|QUICKSIGHT_USER_NAME: '$QUICKSIGHT_USER'|" "$CDK_FILE"
  fi
  echo "✅ QUICKSIGHT_USER_NAME 업데이트 완료"
else
  echo "⚠️  QUICKSIGHT_USER_NAME을 찾을 수 없습니다."
fi

echo ""
echo "✨ 환경 변수 설정 완료!"
echo ""
echo "📋 업데이트된 값:"
grep -A 2 "QUICKSIGHT_AGENT_ID:" "$CDK_FILE" | head -3
echo ""
echo "다음 단계:"
echo "1. CDK 배포:"
echo "   cd infrastructure"
echo "   cdk deploy"
echo ""
echo "2. Lambda 환경 변수 확인:"
echo "   aws lambda get-function-configuration \\"
echo "     --function-name \$(aws lambda list-functions --query \"Functions[?contains(FunctionName, 'QuickSightEmbedFn')].FunctionName\" --output text) \\"
echo "     --query 'Environment.Variables.{AGENT_ID:QUICKSIGHT_AGENT_ID,USER_NAME:QUICKSIGHT_USER_NAME}'"
echo ""
