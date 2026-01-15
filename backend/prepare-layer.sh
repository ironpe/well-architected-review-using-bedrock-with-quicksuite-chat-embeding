#!/bin/bash

# Prepare Lambda Layer with dependencies

set -e

echo "Preparing Lambda Layer..."

# Create layer directory
rm -rf layer
mkdir -p layer/nodejs

# Copy package.json and package-lock.json
cp package.json layer/nodejs/
cp package-lock.json layer/nodejs/ 2>/dev/null || true

# Install production dependencies only
# (devDependencies like @aws-sdk, canvas, pdf-to-png-converter are excluded)
cd layer/nodejs
npm install --production --no-optional

# Remove unnecessary files
rm -rf .npm

cd ../..

echo "Lambda Layer prepared in backend/layer/"
