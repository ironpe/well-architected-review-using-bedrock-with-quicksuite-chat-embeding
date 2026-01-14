#!/bin/bash

# Architecture Review System - Setup Script

set -e

echo "=========================================="
echo "Architecture Review System Setup"
echo "=========================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18 or higher is required"
    exit 1
fi
echo "✓ Node.js version: $(node -v)"
echo ""

# Install root dependencies
echo "Installing root dependencies..."
npm install
echo "✓ Root dependencies installed"
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..
echo "✓ Frontend dependencies installed"
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
cd ..
echo "✓ Backend dependencies installed"
echo ""

# Install infrastructure dependencies
echo "Installing infrastructure dependencies..."
cd infrastructure
npm install
cd ..
echo "✓ Infrastructure dependencies installed"
echo ""

# Create environment files if they don't exist
echo "Setting up environment files..."

if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    echo "✓ Created frontend/.env (please update with your values)"
else
    echo "✓ frontend/.env already exists"
fi

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env (please update with your values)"
else
    echo "✓ backend/.env already exists"
fi

if [ ! -f "infrastructure/.env" ]; then
    cp infrastructure/.env.example infrastructure/.env
    echo "✓ Created infrastructure/.env (please update with your values)"
else
    echo "✓ infrastructure/.env already exists"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update environment variables in:"
echo "   - frontend/.env"
echo "   - backend/.env"
echo "   - infrastructure/.env"
echo ""
echo "2. Build the project:"
echo "   npm run build:all"
echo ""
echo "3. Deploy infrastructure:"
echo "   cd infrastructure && npm run deploy"
echo ""
echo "4. Start frontend development server:"
echo "   cd frontend && npm run dev"
echo ""
