#!/bin/bash

# PyMuPDF Layer 빌드 스크립트
# Python 3.11 기반 Lambda 환경용

set -e

echo "🚀 Building PyMuPDF Layer for Lambda..."

# 클린업
rm -rf python
rm -f pymupdf-layer.zip

# Python 패키지 디렉토리 생성
mkdir -p python/lib/python3.11/site-packages

# PyMuPDF 설치
echo "📦 Installing PyMuPDF..."
pip3 install pymupdf -t python/lib/python3.11/site-packages/ --platform manylinux2014_x86_64 --only-binary=:all: --python-version 3.11

# Python 스크립트 복사
echo "📋 Copying Python script..."
cp convert_pdf.py python/

# ZIP 생성
echo "📦 Creating ZIP..."
cd python
zip -r ../pymupdf-layer.zip . -x "*.pyc" "*__pycache__*" "*.dist-info/*"
cd ..

echo ""
echo "✅ PyMuPDF Layer created successfully!"
ls -lh pymupdf-layer.zip
echo ""
echo "📊 Layer contents:"
unzip -l pymupdf-layer.zip | head -20
echo ""
echo "Next steps:"
echo "1. Update CDK stack to use this layer"
echo "2. Deploy: cd ../../infrastructure && cdk deploy"
