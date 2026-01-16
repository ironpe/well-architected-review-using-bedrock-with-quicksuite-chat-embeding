#!/bin/bash
set -e

echo "🚀 MCP Lambda 패키징 시작..."
rm -f lambda-code.zip

TEMP_DIR=$(mktemp -d)
echo "📦 dist 복사 중..."
cp -r dist "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"

echo "📦 필수 의존성 복사 중..."
mkdir -p "$TEMP_DIR/node_modules"

# AWS SDK 및 관련 의존성
for module in @aws-sdk @smithy mnemonist obliterator uuid tslib fast-xml-parser strnum; do
  if [ -d "../node_modules/$module" ]; then
    cp -r "../node_modules/$module" "$TEMP_DIR/node_modules/" 2>/dev/null || true
  fi
done

cd "$TEMP_DIR"
echo "📦 ZIP 생성 중..."
zip -r lambda-code.zip . -q
mv lambda-code.zip "$OLDPWD/"
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

SIZE=$(ls -lh lambda-code.zip | awk '{print $5}')
echo "✅ 완료: lambda-code.zip ($SIZE)"
