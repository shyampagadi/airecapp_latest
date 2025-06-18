#!/bin/bash

# Simple Bedrock Analysis Lambda Deployment Script

# Configuration
LAMBDA_NAME="candidate-analysis-lambda"
ZIP_FILE="lambda_deployment.zip"
REGION=${AWS_REGION:-"us-east-1"}

echo "Creating deployment package for $LAMBDA_NAME..."

# Create deployment directory
echo "Setting up package directory..."
mkdir -p package
cp lambda_function.py package/

# Install dependencies in package directory
echo "Installing boto3 in the package directory..."
pip install boto3 --target ./package
cd package

# Create the zip file
echo "Creating ZIP deployment package..."
zip -r ../$ZIP_FILE .
cd ..

echo "Deployment package created: $ZIP_FILE"
echo ""
echo "To deploy the Lambda function, use:"
echo "aws lambda create-function \\"
echo "  --function-name $LAMBDA_NAME \\"
echo "  --runtime python3.9 \\"
echo "  --handler lambda_function.lambda_handler \\"
echo "  --role YOUR_LAMBDA_ROLE_ARN \\"
echo "  --zip-file fileb://$ZIP_FILE \\"
echo "  --region $REGION"
echo ""
echo "To update an existing Lambda function:"
echo "aws lambda update-function-code \\"
echo "  --function-name $LAMBDA_NAME \\"
echo "  --zip-file fileb://$ZIP_FILE \\"
echo "  --region $REGION"

echo ""
echo "Note: Even if boto3 is installed globally on your system,"
echo "it must be included in the deployment package for AWS Lambda." 