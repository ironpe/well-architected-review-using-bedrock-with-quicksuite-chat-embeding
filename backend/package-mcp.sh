#!/bin/bash
set -e

echo "🚀 MCP Lambda 패키징 시작..."
rm -f lambda-code.zip

TEMP_DIR=$(mktemp -d)
echo "📦 dist 복사 중..."
cp -r dist "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"

echo "📦 필수 의존성만 복사 중..."
mkdir -p "$TEMP_DIR/node_modules"

# AWS SDK (필수)
cp -r ../node_modules/@aws-sdk "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/@smithy "$TEMP_DIR/node_modules/" 2>/dev/null || true

# 기타 필수 의존성
cp -r ../node_modules/uuid "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/tslib "$TEMP_DIR/node_modules/" 2>/dev/null || true

cd "$TEMP_DIR"
zip -r lambda-code.zip . -q
mv lambda-code.zip "$OLDPWD/"
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

SIZE=$(ls -lh lambda-code.zip | awk '{print $5}')
echo "✅ 완료: lambda-code.zip ($SIZE)"
