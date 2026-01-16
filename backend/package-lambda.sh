#!/bin/bash
set -e

echo "🚀 Lambda 패키지 생성..."
rm -f lambda-code.zip

TEMP_DIR=$(mktemp -d)
cp -r dist "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
mkdir -p "$TEMP_DIR/node_modules"
mkdir -p "$TEMP_DIR/fonts"

# 한글 폰트 복사
echo "📝 한글 폰트 복사 중..."
cp -r fonts/NotoSansKR-Regular.ttf "$TEMP_DIR/fonts/" 2>/dev/null || echo "⚠️  폰트 파일 없음"

# 루트 node_modules에서 복사
echo "📦 의존성 복사 중..."
cp -r ../node_modules/@aws-sdk "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/@smithy "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/pdf-lib "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/@pdf-lib "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/pdf-parse "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/pdf-to-png-converter "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/pdfjs-dist "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/canvas "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/@mapbox "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/uuid "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/jszip "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/docx "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/pdfkit "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/tslib "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/mnemonist "$TEMP_DIR/node_modules/" 2>/dev/null || true
cp -r ../node_modules/obliterator "$TEMP_DIR/node_modules/" 2>/dev/null || true

cd "$TEMP_DIR"
zip -r lambda-code.zip . -q -x "*.map" "*.md" "*.txt" "*/test/*" "*/tests/*" "*/docs/*" "*/examples/*"
mv lambda-code.zip "$OLDPWD/"
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

SIZE=$(ls -lh lambda-code.zip | awk '{print $5}')
echo "✅ 완료: lambda-code.zip ($SIZE)"
