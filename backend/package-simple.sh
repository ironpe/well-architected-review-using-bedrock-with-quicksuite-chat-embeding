#!/bin/bash
set -e

echo "🚀 Lambda 패키징 시작..."
rm -f lambda-code.zip

echo "📦 ZIP 생성 중..."
zip -r lambda-code.zip dist/ package.json -q

echo "📦 node_modules 추가 중..."
cd ..
zip -r backend/lambda-code.zip node_modules/@aws-sdk -q
zip -r backend/lambda-code.zip node_modules/@smithy -q
zip -r backend/lambda-code.zip node_modules/uuid -q
zip -r backend/lambda-code.zip node_modules/jszip -q
zip -r backend/lambda-code.zip node_modules/docx -q
zip -r backend/lambda-code.zip node_modules/pdfkit -q
zip -r backend/lambda-code.zip node_modules/tslib -q
cd backend

SIZE=$(ls -lh lambda-code.zip | awk '{print $5}')
echo "✅ 완료: lambda-code.zip ($SIZE)"
