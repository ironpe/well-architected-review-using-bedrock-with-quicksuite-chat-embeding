#!/bin/bash
set -e

echo "🚀 Lambda 패키징 시작..."
rm -f lambda-code.zip

echo "📦 ZIP 생성 중 (dist + package.json)..."
zip -r lambda-code.zip dist/ package.json -q

echo "📦 node_modules 추가 중 (루트에서)..."
cd ..
if [ -d "node_modules" ]; then
  zip -r backend/lambda-code.zip node_modules/ -q
  cd backend
else
  echo "⚠️  node_modules 폴더가 없습니다. npm install을 먼저 실행하세요."
  exit 1
fi

SIZE=$(ls -lh lambda-code.zip | awk '{print $5}')
echo "✅ 완료: lambda-code.zip ($SIZE)"
