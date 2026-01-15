#!/bin/bash

# Update environment variables from CDK outputs
# Run this script after deploying the CDK stack

set -e

echo "=========================================="
echo "Updating Environment Variables from CDK"
echo "=========================================="
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    exit 1
fi

# Get stack name from infrastructure/.env or use default
STACK_NAME=${STACK_NAME:-"ArchReview-Minimal"}

echo "Fetching CloudFormation outputs for stack: $STACK_NAME"
echo ""

# Get stack outputs
OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output json 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "Error: Could not fetch stack outputs. Make sure the stack is deployed."
    echo "Run: cd infrastructure && cdk deploy"
    exit 1
fi

# Extract values
USER_POOL_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolId") | .OutputValue')
CLIENT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue')
API_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiGatewayUrl") | .OutputValue')

# Update frontend/.env
if [ -f "frontend/.env" ]; then
    echo "Updating frontend/.env..."
    
    if [ -n "$USER_POOL_ID" ]; then
        sed -i.bak "s|VITE_COGNITO_USER_POOL_ID=.*|VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID|" frontend/.env
        echo "✓ Updated VITE_COGNITO_USER_POOL_ID"
    fi
    
    if [ -n "$CLIENT_ID" ]; then
        sed -i.bak "s|VITE_COGNITO_CLIENT_ID=.*|VITE_COGNITO_CLIENT_ID=$CLIENT_ID|" frontend/.env
        echo "✓ Updated VITE_COGNITO_CLIENT_ID"
    fi
    
    if [ -n "$API_URL" ]; then
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=$API_URL|" frontend/.env
        echo "✓ Updated VITE_API_URL"
    fi
    
    rm -f frontend/.env.bak
    echo ""
    echo "✓ Frontend environment variables updated"
else
    echo "Warning: frontend/.env not found"
fi

echo ""
echo "=========================================="
echo "Environment Update Complete!"
echo "=========================================="
echo ""
echo "Updated values:"
echo "- User Pool ID: $USER_POOL_ID"
echo "- Client ID: $CLIENT_ID"
echo "- API URL: $API_URL"
echo ""
echo "You can now start the frontend:"
echo "  cd frontend && npm run dev"
echo ""
