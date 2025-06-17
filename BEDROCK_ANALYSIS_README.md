# Bedrock Candidate Analysis API

This repository contains an AWS Lambda function for performing candidate profile analysis using AWS Bedrock AI models. The function connects to API Gateway to provide a REST endpoint for your application.

## Overview

This API analyzes candidate profiles against job requirements using AWS Bedrock Large Language Models (LLMs). It provides structured analysis including:

- Executive summary
- Score analysis
- Key strengths
- Areas for consideration
- Interview recommendations
- Final recommendation

## Setup Instructions

### 1. AWS Lambda Setup

1. Create a new Lambda function:
   - Name: `bedrock-candidate-analysis`
   - Runtime: Python 3.9+
   - Architecture: x86_64
   - Execution role: Create new role with basic Lambda permissions + Bedrock access

2. Upload the Lambda code:
   - Copy the `bedrock_analysis_lambda.py` file to your Lambda function
   - Rename it to `lambda_function.py` in the Lambda console

3. Configure environment variables (optional):
   - `DEFAULT_MODEL_ID` - Default model ID to use (e.g., `meta.llama3-70b-instruct-v1:0`)
   - `AWS_REGION` - AWS region for Bedrock (e.g., `us-east-1`)
   - `LOG_LEVEL` - Logging level (e.g., `INFO`)

4. Configure Lambda settings:
   - Memory: 256 MB (minimum)
   - Timeout: 30 seconds (recommended)
   - Concurrency: As needed for your application

5. Add permission for Bedrock:
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

### 2. API Gateway Setup

1. Create a new REST API:
   - Name: `candidate-analysis-api`
   - Endpoint Type: Regional

2. Create a resource:
   - Resource Path: `/analyze`
   - Enable CORS: Yes

3. Create a method:
   - Method Type: POST
   - Integration Type: Lambda Function
   - Lambda Function: `bedrock-candidate-analysis`
   - Use Lambda Proxy integration: Yes

4. Deploy the API:
   - Stage Name: `prod` (or your preferred stage name)
   - Note the Invoke URL

5. Configure CORS (if needed):
   - Allow Headers: `Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`
   - Allow Methods: `POST,OPTIONS`
   - Allow Origin: Your application domain, or `*` for testing

### 3. Authentication Setup (Recommended)

1. Create a Cognito User Pool:
   - Configure sign-in options, security settings, etc.

2. Create an App Client:
   - Enable required OAuth flows
   - Set allowed scopes

3. Configure API Gateway Authorizer:
   - Type: Cognito
   - User Pool: Your created user pool
   - Token Source: `Authorization` header

4. Apply the authorizer to the `/analyze` endpoint

## Testing Lambda Function in AWS Console

Before integrating with API Gateway, you should test the Lambda function directly in the AWS Console:

1. Navigate to your `bedrock-candidate-analysis` Lambda in the AWS Console
2. Select the "Test" tab
3. Create a new test event named "CandidateAnalysisTest"
4. Paste the following JSON as the test event:

```json
{
  "body": "{\"candidateData\":{\"personal_info\":{\"name\":\"Alex Johnson\",\"email\":\"alex@example.com\",\"phone_number\":\"+1234567890\",\"address\":\"456 Tech Avenue, San Francisco, CA\",\"linkedin_url\":\"https://linkedin.com/in/alexjohnson\"},\"skills\":{\"matching\":[\"Python\",\"React\",\"AWS Lambda\"],\"missing\":[\"Docker\",\"Kubernetes\"],\"all\":[\"Python\",\"JavaScript\",\"React\",\"Node.js\",\"AWS Lambda\",\"GraphQL\",\"MongoDB\",\"PostgreSQL\"]},\"experience\":{\"years\":4,\"required\":5,\"difference\":-1},\"positions\":[\"Full Stack Developer\",\"Frontend Developer\",\"Junior Developer\"],\"education\":[{\"degree\":\"Bachelor of Science in Computer Engineering\",\"institution\":\"University of Technology\",\"year\":\"2019\"}],\"scores\":{\"overall\":78,\"skill_match\":80,\"experience_match\":75}},\"jobInfo\":{\"job_title\":\"Senior Full Stack Developer\",\"required_skills\":[\"Python\",\"React\",\"AWS Lambda\",\"Docker\",\"Kubernetes\"],\"required_experience\":5},\"modelId\":\"meta.llama3-70b-instruct-v1:0\",\"parameters\":{\"max_gen_len\":512,\"temperature\":0.5,\"top_p\":0.9}}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "testuser"
      }
    }
  }
}
```

> **Note:** The test event uses a string format for the `body` field to simulate how API Gateway passes request data to Lambda. If you're testing direct invocations, you can simplify this format.

5. Click "Test" to execute the function
6. Review the execution results:
   - Check the returned structure matches the expected response
   - Verify all sections are populated in the analysis
   - Check the CloudWatch logs for detailed operation info

### Alternative Test Data (Software Engineer)

```json
{
  "body": "{\"candidateData\":{\"personal_info\":{\"name\":\"Sam Rivera\",\"email\":\"sam@example.com\",\"phone_number\":\"+1987654321\",\"address\":\"789 Code Street, Seattle, WA\",\"linkedin_url\":\"https://linkedin.com/in/samrivera\"},\"skills\":{\"matching\":[\"Java\",\"Spring Boot\",\"Microservices\",\"SQL\"],\"missing\":[\"Kubernetes\",\"CI/CD\"],\"all\":[\"Java\",\"Spring Boot\",\"Microservices\",\"SQL\",\"REST API\",\"Git\",\"JUnit\",\"Maven\"]},\"experience\":{\"years\":7,\"required\":5,\"difference\":2},\"positions\":[\"Senior Software Engineer\",\"Software Engineer\",\"Junior Developer\"],\"education\":[{\"degree\":\"Master of Science in Computer Science\",\"institution\":\"Tech University\",\"year\":\"2016\"},{\"degree\":\"Bachelor of Science in Software Engineering\",\"institution\":\"State University\",\"year\":\"2014\"}],\"scores\":{\"overall\":88,\"skill_match\":75,\"experience_match\":100}},\"jobInfo\":{\"job_title\":\"Senior Java Developer\",\"required_skills\":[\"Java\",\"Spring Boot\",\"Microservices\",\"SQL\",\"Kubernetes\",\"CI/CD\"],\"required_experience\":5},\"modelId\":\"anthropic.claude-3-sonnet-20240229-v1:0\",\"parameters\":{\"max_tokens_to_sample\":1024,\"temperature\":0.3,\"top_p\":0.9}}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "testuser"
      }
    }
  }
}
```

### Alternative Test Data (Data Scientist)

```json
{
  "body": "{\"candidateData\":{\"personal_info\":{\"name\":\"Taylor Kim\",\"email\":\"taylor@example.com\",\"phone_number\":\"+1654987321\",\"address\":\"321 Data Drive, Boston, MA\",\"linkedin_url\":\"https://linkedin.com/in/taylorkim\"},\"skills\":{\"matching\":[\"Python\",\"Machine Learning\",\"SQL\",\"TensorFlow\"],\"missing\":[\"Spark\",\"AWS\"],\"all\":[\"Python\",\"Machine Learning\",\"SQL\",\"TensorFlow\",\"Pandas\",\"NumPy\",\"Scikit-learn\",\"Data Visualization\",\"Jupyter\"]},\"experience\":{\"years\":3,\"required\":4,\"difference\":-1},\"positions\":[\"Data Scientist\",\"Data Analyst\"],\"education\":[{\"degree\":\"Master of Science in Data Science\",\"institution\":\"Data University\",\"year\":\"2021\"},{\"degree\":\"Bachelor of Science in Statistics\",\"institution\":\"Analytics College\",\"year\":\"2019\"}],\"scores\":{\"overall\":82,\"skill_match\":85,\"experience_match\":75}},\"jobInfo\":{\"job_title\":\"Senior Data Scientist\",\"required_skills\":[\"Python\",\"Machine Learning\",\"SQL\",\"TensorFlow\",\"Spark\",\"AWS\"],\"required_experience\":4},\"modelId\":\"amazon.titan-text-express-v1:0\",\"parameters\":{\"maxTokenCount\":800,\"temperature\":0.4,\"topP\":0.9}}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "testuser"
      }
    }
  }
}
```

## Using the API

### Request Format

```json
{
  "candidateData": {
    "personal_info": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone_number": "+1234567890",
      "address": "123 Street, City",
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
        "degree": "Bachelor of Science in Computer Science",
        "institution": "University of Example",
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
  "modelId": "meta.llama3-70b-instruct-v1:0",
  "parameters": {
    "max_gen_len": 512,
    "temperature": 0.5,
    "top_p": 0.9
  }
}
```

### Response Format

```json
{
  "success": true,
  "message": "Successfully analyzed candidate profile",
  "data": {
    "rawText": "Full response text from the model",
    "sections": {
      "executiveSummary": "John Doe is a skilled Senior Frontend Developer with 5 years of experience...",
      "scoreAnalysis": "The candidate scored 85% overall due to strong experience match (100%)...",
      "keyStrengths": "- Strong JavaScript and React skills\n- 5 years of relevant experience\n- ...",
      "areasForConsideration": "- No experience with AWS and Docker\n- ...",
      "interviewRecommendations": "- Probe knowledge of cloud deployment practices\n- ...",
      "finalRecommendation": "John Doe is a strong candidate who exceeds the required experience..."
    }
  },
  "metadata": {
    "model": "meta.llama3-70b-instruct-v1:0",
    "parameters": {
      "max_gen_len": 512,
      "temperature": 0.5,
      "top_p": 0.9
    },
    "processing_time_ms": 3245,
    "bedrock_processing_time_ms": 3050
  }
}
```

## Supported Models

The Lambda function supports multiple AWS Bedrock models:

- **Meta Llama 3**: `meta.llama3-70b-instruct-v1:0`, `meta.llama3-8b-instruct-v1:0`
- **Amazon Titan**: `amazon.titan-text-express-v1:0`, `amazon.titan-text-lite-v1:0`
- **Anthropic Claude**: `anthropic.claude-3-sonnet-20240229-v1:0`, `anthropic.claude-instant-v1`, `anthropic.claude-v2:1`

## Troubleshooting

### Common Issues

1. **"Error creating Bedrock client"**:
   - Check that the Lambda has proper IAM permissions for Bedrock
   - Verify the AWS region has Bedrock available

2. **"Error invoking Bedrock model"**:
   - Check model ID is valid and accessible
   - Ensure the Lambda execution role has the necessary permissions
   - Verify the model is available in your region

3. **CORS Errors**:
   - Check API Gateway CORS configuration
   - Verify headers in your frontend application

4. **Authentication Errors**:
   - Check Cognito token validity
   - Verify Authorization header format

### Monitoring

Monitor the Lambda function using CloudWatch Logs and Metrics:

- **Log Groups**: `/aws/lambda/bedrock-candidate-analysis`
- **Key metrics**: Duration, Invocation count, Error count

## Cost Considerations

Usage of this API incurs costs from multiple AWS services:

- **AWS Lambda**: Charged based on request count and duration
- **API Gateway**: Charged per request
- **AWS Bedrock**: Charged per token for input and output
  
Costs for AWS Bedrock vary significantly by model. The Llama 3 models are typically more cost-effective than Claude models, but may have different capabilities.

## Security Considerations

1. **Authentication**: Always implement proper authentication for production use
2. **Input Validation**: The Lambda validates inputs, but additional validation is recommended
3. **Response Sanitization**: Responses from LLMs should be treated as untrusted and sanitized before display
4. **Prompt Injection**: The function includes measures to prevent prompt injection
5. **Data Security**: Do not include sensitive PII in prompts 