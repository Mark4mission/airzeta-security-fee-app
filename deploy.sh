#!/bin/bash

# Branch Security Cost Submission System - Quick Deploy Script

echo "🚀 Branch Security Cost Submission System Deployment"
echo "=================================================="
echo ""

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ dist folder not found. Building first..."
    npm run build
fi

echo ""
echo "Choose deployment platform:"
echo "1) Vercel (Recommended)"
echo "2) Netlify"
echo "3) Build only (manual deployment)"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📦 Deploying to Vercel..."
        echo ""
        
        # Check if vercel is installed
        if ! command -v vercel &> /dev/null; then
            echo "Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        echo "Logging in to Vercel..."
        vercel login
        
        echo ""
        echo "Deploying to production..."
        vercel --prod
        
        echo ""
        echo "✅ Deployment complete!"
        ;;
        
    2)
        echo ""
        echo "📦 Deploying to Netlify..."
        echo ""
        
        # Check if netlify is installed
        if ! command -v netlify &> /dev/null; then
            echo "Installing Netlify CLI..."
            npm install -g netlify-cli
        fi
        
        echo "Logging in to Netlify..."
        netlify login
        
        echo ""
        echo "Deploying to production..."
        netlify deploy --prod --dir=dist
        
        echo ""
        echo "✅ Deployment complete!"
        ;;
        
    3)
        echo ""
        echo "📦 Building for manual deployment..."
        npm run build
        
        echo ""
        echo "✅ Build complete!"
        echo ""
        echo "📂 Files are in the 'dist' folder"
        echo ""
        echo "Manual deployment options:"
        echo "- Upload dist folder to Netlify Drop: https://app.netlify.com/drop"
        echo "- Deploy to your own server"
        echo "- Use FTP/SFTP to upload files"
        ;;
        
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Done!"
