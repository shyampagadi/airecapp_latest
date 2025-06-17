#!/bin/bash

# Bedrock Candidate Analysis Lambda Deployment Script
# ===================================================

# Configuration (modify as needed)
LAMBDA_FUNCTION_NAME="bedrock-candidate-analysis"
LAMBDA_ROLE_NAME="bedrock-analysis-lambda-role"
AWS_REGION="us-east-1"
ZIP_FILENAME="lambda_deployment.zip"
PYTHON_VERSION="python3.9"

echo "Starting deployment of $LAMBDA_FUNCTION_NAME Lambda function"
echo "========================================================"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if the Lambda function already exists
aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION &> /dev/null
FUNCTION_EXISTS=$?

# Create deployment package
echo "Creating deployment package..."
rm -f $ZIP_FILENAME
zip -j $ZIP_FILENAME bedrock_analysis_lambda.py

# Create IAM role if needed
if [ $FUNCTION_EXISTS -ne 0 ]; then
    echo "Creating new IAM role: $LAMBDA_ROLE_NAME..."
    
    # Create trust policy document
    cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create the role
    ROLE_ARN=$(aws iam create-role \
        --role-name $LAMBDA_ROLE_NAME \
        --assume-role-policy-document file://trust-policy.json \
        --output text \
        --query 'Role.Arn')
    
    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name $LAMBDA_ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    # Create and attach Bedrock policy
    cat > bedrock-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name $LAMBDA_ROLE_NAME \
        --policy-name BedrockAccess \
        --policy-document file://bedrock-policy.json
    
    # Wait for the role to propagate
    echo "Waiting for IAM role to propagate (15 seconds)..."
    sleep 15
fi

# Get the role ARN if we didn't just create it
if [ -z "$ROLE_ARN" ]; then
    ROLE_ARN=$(aws iam get-role \
        --role-name $LAMBDA_ROLE_NAME \
        --output text \
        --query 'Role.Arn')
fi

# Create or update the Lambda function
if [ $FUNCTION_EXISTS -ne 0 ]; then
    echo "Creating new Lambda function: $LAMBDA_FUNCTION_NAME..."
    aws lambda create-function \
        --function-name $LAMBDA_FUNCTION_NAME \
        --runtime $PYTHON_VERSION \
        --handler bedrock_analysis_lambda.lambda_handler \
        --role $ROLE_ARN \
        --zip-file fileb://$ZIP_FILENAME \
        --timeout 30 \
        --memory-size 256 \
        --region $AWS_REGION \
        --environment "Variables={DEFAULT_MODEL_ID=meta.llama3-70b-instruct-v1:0}"
else
    echo "Updating existing Lambda function: $LAMBDA_FUNCTION_NAME..."
    aws lambda update-function-code \
        --function-name $LAMBDA_FUNCTION_NAME \
        --zip-file fileb://$ZIP_FILENAME \
        --region $AWS_REGION
fi

# Clean up temporary files
rm -f $ZIP_FILENAME trust-policy.json bedrock-policy.json

echo ""
echo "Deployment completed!"
echo "--------------------"
echo "Function name: $LAMBDA_FUNCTION_NAME"
echo "Region: $AWS_REGION"
echo ""
echo "Next Steps:"
echo "1. Configure API Gateway to integrate with the Lambda function"
echo "2. Set up Cognito authentication if needed"
echo "3. Test the endpoint with your application"
echo ""
echo "For more information, see BEDROCK_ANALYSIS_README.md" 