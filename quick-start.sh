#!/bin/bash

echo "🍽️  Restaurant AI Server - Quick Start"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Check if MongoDB is running (optional check)
if command -v mongod &> /dev/null; then
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running. You may need to start it with 'mongod'"
    fi
else
    echo "⚠️  MongoDB not found. You may need to install it or use MongoDB Atlas."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created. Please edit it with your configuration."
        echo "   - Add your OpenAI API key"
        echo "   - Update MongoDB connection string if needed"
    else
        echo "❌ .env.example not found. Please create .env file manually."
    fi
else
    echo "✅ .env file exists"
fi

echo ""
echo "🚀 Ready to start the server!"
echo ""
echo "Options:"
echo "1. Start with sample data: npm run dev"
echo "2. Test basic functionality: node test-server.js"
echo "3. Seed database: node utils/seedData.js"
echo ""
echo "📚 Check README.md for detailed instructions"
echo "🔗 API will be available at: http://localhost:3000"
echo ""
echo "Happy coding! 🎉"
