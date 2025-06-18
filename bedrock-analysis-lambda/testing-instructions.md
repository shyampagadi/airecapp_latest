# Testing the Bedrock Analysis Lambda Function

This document provides instructions for testing the Bedrock Candidate Analysis Lambda function, both locally and after deployment.

## Prerequisites

- AWS CLI configured
- Access to AWS Bedrock service
- Python 3.9+ installed locally

## Local Testing

### 1. Install Dependencies

```bash
pip install boto3
```

### 2. Configure AWS Credentials

Make sure you have AWS credentials configured either through:
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- AWS CLI configuration (`~/.aws/credentials`)
- IAM roles if testing in AWS environments

### 3. Create a Test Event File

Use the provided `lambda-test-event.json` or create your own with the structure:

```json
{
  "body": {
    "candidateData": {
      "personal_info": {
        "name": "Jane Doe"
      },
      "skills": {
        "matching": ["JavaScript", "React", "Node.js"],
        "missing": ["GraphQL", "AWS Lambda"],
        "all": ["JavaScript", "React", "Node.js", "HTML", "CSS"]
      },
      "experience": {
        "years": 5
      },
      "positions": ["Senior Frontend Developer"],
      "education": [
        {
          "degree": "BS Computer Science",
          "institution": "University of Technology",
          "year": "2018"
        }
      ],
      "scores": {
        "overall": 85,
        "skill_match": 80,
        "experience_match": 90
      }
    },
    "jobInfo": {
      "job_title": "Frontend Developer",
      "required_skills": ["JavaScript", "React", "GraphQL", "AWS Lambda"],
      "required_experience": 3
    }
  }
}
```

### 4. Test with API Gateway Format

To test as if the request came through API Gateway, update your test JSON to:

```json
{
  "httpMethod": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"candidateData\":{...},\"jobInfo\":{...}}"
}
```

Note: The body must be a stringified JSON when testing with API Gateway format.

## Testing After Deployment

### Option 1: AWS Console Testing

1. Go to AWS Lambda console
2. Navigate to your deployed function
3. Click on the "Test" tab
4. Create a new test event using the sample JSON
5. Click "Test" to execute

### Option 2: API Gateway Testing

After integrating with API Gateway:

1. Get your API Gateway endpoint URL
2. Use a tool like Postman or curl to send a POST request:

```bash
curl -X POST \
  https://your-api-gateway-url.amazonaws.com/prod/analysis \
  -H 'Content-Type: application/json' \
  -H 'Authorization: YOUR_COGNITO_TOKEN' \
  -d '{
    "candidateData": {...},
    "jobInfo": {...}
  }'
```

### Option 3: Direct Lambda Invocation via AWS CLI

```bash
aws lambda invoke \
  --function-name candidate-analysis-lambda \
  --payload file://lambda-test-event.json \
  output.json

cat output.json  # View the response
```

## Troubleshooting

1. **Bedrock Access Issues**:
   - Check that your Lambda has permissions to access Bedrock
   - Verify the region is correct in your code and environment variables

2. **Response Format Problems**:
   - Check the Lambda function logs in CloudWatch
   - Verify the request payload matches the expected format

3. **Model Errors**:
   - Ensure the specified model ID is available in your AWS region
   - Check for any quotas or limits that might be exceeded

## Monitoring and Logging

- View CloudWatch logs for the Lambda function
- Monitor Lambda execution metrics in CloudWatch
- Check API Gateway logs if using the API Gateway endpoint
 