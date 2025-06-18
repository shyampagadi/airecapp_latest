# Bedrock Candidate Analysis Lambda

This Lambda function analyzes candidate profiles against job requirements using AWS Bedrock AI models. It provides structured analysis of candidates to streamline the recruitment process.

## Overview

The Lambda function accepts candidate data and job information, generates an analysis using AWS Bedrock, and returns a structured response with different sections of analysis.

## Requirements

- AWS Account with access to Bedrock
- IAM permissions for Lambda and Bedrock
- Python 3.9+ (provided by Lambda runtime)

## Deployment

### Quick Deployment (Copy-Paste Method)

Since boto3 is pre-installed in AWS Lambda environments, the simplest deployment method is:

1. Create a new Lambda function in the AWS Console:
   - Runtime: Python 3.9+
   - Architecture: x86_64
   - Execution role: Create new role with Bedrock permissions

2. Copy the contents of `lambda_function.py` and paste it into the inline editor in the Lambda console

3. Set environment variables:
   - `REACT_APP_BEDROCK_MODEL_ID` - Bedrock model ID to use (defaults to `meta.llama3-70b-instruct-v1:0` if not set)
   - `AWS_REGION` - AWS region for Bedrock (e.g., `us-east-1`)

4. Test the function using the provided `test-event.json` content

5. Set the Lambda timeout to at least 30 seconds (Bedrock can take time to respond)

### Alternative Deployment Methods

If you need to add more dependencies beyond boto3 in the future, you can use:

1. The provided `deploy.sh` script to create a deployment package
2. AWS SAM or AWS CDK for infrastructure as code

### IAM Permissions

Your Lambda execution role needs these permissions:

```json
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
```

## API Gateway Integration

1. Create a new REST API in API Gateway
2. Create a resource `/analyze`
3. Add a `POST` method with Lambda proxy integration
4. Deploy the API to a stage
5. Set up CORS if needed

## Input Format

The Lambda function expects a JSON payload with the following structure:

```json
{
  "candidateData": {
    "personal_info": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone_number": "+1234567890",
      "address": "123 Main St, City, State",
      "linkedin_url": "https://linkedin.com/in/johndoe"
    },
    "skills": {
      "matching": ["JavaScript", "React", "Node.js"],
      "missing": ["AWS", "Docker"],
      "all": ["JavaScript", "React", "Node.js", "HTML", "CSS", "MongoDB"]
    },
    "experience": {
      "years": 5,
      "required": 3,
      "difference": 2
    },
    "positions": ["Senior Frontend Developer", "Web Developer"],
    "education": [
      {
        "degree": "B.S. Computer Science",
        "institution": "University of Technology",
        "year": "2018"
      }
    ],
    "scores": {
      "overall": 85,
      "skill_match": 70,
      "experience_match": 100
    }
  },
  "jobInfo": {
    "job_title": "Senior Frontend Developer",
    "required_skills": ["JavaScript", "React", "AWS", "Docker", "Node.js"],
    "required_experience": 3
  },
  "parameters": {
    "max_gen_len": 512,
    "temperature": 0.5,
    "top_p": 0.9
  }
}
```

### Required Fields:

- `candidateData`: Information about the candidate
- `jobInfo`: Information about the job

### Optional Fields:

- `parameters`: Model-specific parameters (max_gen_len, temperature, top_p)

## Output Format

The Lambda function returns a JSON response with the following structure:

```json
{
  "success": true,
  "message": "Successfully analyzed candidate profile",
  "data": {
    "rawText": "Full raw response from the model",
    "sections": {
      "executiveSummary": "John Doe is a skilled Senior Frontend Developer...",
      "scoreAnalysis": "The candidate scored 85% overall due to strong...",
      "keyStrengths": "- Strong JavaScript and React skills...",
      "areasForConsideration": "- No experience with AWS and Docker...",
      "interviewRecommendations": "- Ask about cloud deployment experience...",
      "finalRecommendation": "John Doe is recommended for this position..."
    }
  },
  "metadata": {
    "model": "meta.llama3-70b-instruct-v1:0",
    "parameters": {
      "max_gen_len": 512,
      "temperature": 0.5,
      "top_p": 0.9
    },
    "processing_time_ms": 1234,
    "bedrock_processing_time_ms": 1000
  }
}
```

## Supported Model

This Lambda function is designed to use Llama 3 from Meta as the default model:

- **Default Model**: `meta.llama3-70b-instruct-v1:0`

You can specify a different model by setting the `REACT_APP_BEDROCK_MODEL_ID` environment variable in your Lambda configuration. This will override the default model.

## React Integration

To integrate with your React application:

1. Update your `bedrockApiService.js` to point to your API Gateway endpoint:

```javascript
// Set the API Gateway URL in your environment variables
// REACT_APP_API_GATEWAY_URL=https://your-api-id.execute-api.region.amazonaws.com/stage
```

2. Make requests to the API endpoint from your application, including the proper candidate and job data.

## Security Considerations

- Implement proper authentication for your API Gateway
- Set up CORS correctly for your application domain
- Use IAM roles with least privilege
- Consider encryption for sensitive data

# Bedrock Analysis Lambda API Setup Guide

This guide provides step-by-step instructions to set up the Bedrock Candidate Analysis API with API Gateway and Cognito authentication.

## Prerequisites
- AWS Account with proper permissions
- AWS CLI configured with your credentials
- Lambda function already deployed (using `deploy.sh`)

## Step 1: Create Cognito User Pool

1. Go to AWS Console > Cognito > User Pools
2. Click "Create user pool"
3. Configure sign-in options:
   - Select "Email" as the primary authentication option
   - Click "Next"
4. Configure security requirements:
   - Password policy: Choose appropriate strength
   - MFA: Optional (Enable if needed)
   - Click "Next"
5. Configure sign-up experience:
   - Self-service sign-up: Enable or disable as needed
   - Required attributes: Select at minimum "name" and "email"
   - Click "Next"
6. Configure message delivery:
   - Use Cognito's default email provider or configure SES
   - Click "Next"
7. Integrate your app:
   - User pool name: `bedrock-analysis-user-pool`
   - App client name: `bedrock-analysis-client`
   - Client secret: No client secret
   - Click "Next"
8. Review and create the user pool
9. Note your User Pool ID and App Client ID

## Step 2: Create API Gateway

1. Go to AWS Console > API Gateway
2. Click "Create API"
3. Select "REST API" and click "Build"
4. API details:
   - API name: `bedrock-analysis-api`
   - Description: "API for Bedrock Candidate Analysis"
   - Endpoint Type: Regional
5. Click "Create API"

## Step 3: Create Resources and Methods

1. In your API, click "Create Resource"
2. Resource configuration:
   - Resource Name: `analysis`
   - Resource Path: `/analysis`
   - Enable API Gateway CORS: Yes
3. Click "Create Resource"
4. Select the new resource and click "Create Method"
5. Choose "POST" and click the checkmark
6. Method setup:
   - Integration type: Lambda Function
   - Lambda Region: Select your region (e.g., us-east-1)
   - Lambda Function: `candidate-analysis-lambda` (your deployed Lambda)
   - Use Lambda Proxy integration: Yes
7. Click "Save"
8. When prompted to add Lambda permission, click "OK"

## Step 4: Configure Cognito Authorization

1. Select the POST method and click "Method Request"
2. Under "Authorization", click the pencil icon
3. Select "Cognito" from the dropdown
4. Enter your Cognito User Pool details:
   - Cognito User Pool: Select your pool (`bedrock-analysis-user-pool`)
   - Token Source: `Authorization`
5. Click the checkmark to save
6. Under "Method Request", expand "OAuth Scopes"
7. Add `email` scope and click the checkmark

## Step 5: Enable CORS

1. Select the `/analysis` resource
2. From the "Actions" dropdown, select "Enable CORS"
3. Configure CORS:
   - Access-Control-Allow-Headers: `'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'`
   - Access-Control-Allow-Methods: `'OPTIONS,POST'`
   - Access-Control-Allow-Origin: `'*'` (restrict to your domain in production)
4. Click "Enable CORS and replace existing CORS headers"
5. Click "Yes, replace existing values"

## Step 6: Deploy the API

1. From the "Actions" dropdown, select "Deploy API"
2. Deployment stage: Select "New Stage"
3. Stage name: `prod`
4. Stage description: "Production stage"
5. Click "Deploy"
6. Note your API Gateway endpoint URL

## Step 7: Update Environment Variables

Update your frontend application with these environment variables:

```
REACT_APP_API_ENDPOINT=https://[your-api-id].execute-api.[region].amazonaws.com/prod/analysis
REACT_APP_USER_POOL_ID=[your-user-pool-id]
REACT_APP_USER_POOL_CLIENT_ID=[your-app-client-id]
REACT_APP_AWS_REGION=[your-region]
```

## Step 8: Test the API

1. Create a test user in your Cognito User Pool
2. Authenticate with the test user to get an ID token
3. Make a POST request to your API endpoint with the Authorization header:
   ```
   Authorization: [id-token]
   ```
4. Check that the API returns successful analysis results

## Troubleshooting

1. **CORS Issues**: 
   - Ensure CORS is properly configured in API Gateway
   - Check that your frontend is sending the Authorization header correctly

2. **Authentication Errors**:
   - Verify the token is valid and not expired
   - Confirm the User Pool and App Client IDs are correct

3. **Lambda Invocation Issues**:
   - Check CloudWatch Logs for your Lambda function
   - Ensure Lambda has proper permissions to access Bedrock

## Additional Resources

- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [Using Amazon Bedrock with Lambda](https://docs.aws.amazon.com/bedrock/) 