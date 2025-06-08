# AWS API Gateway Setup for Resume PII Data

## Table of Contents
1. Prerequisites
2. AWS Lambda Setup
3. API Gateway Configuration
4. Database Setup
5. Testing and Deployment
6. Frontend Integration
7. Monitoring and Maintenance
8. Integration with OpenSearch API

## 1. Prerequisites

### 1.1 AWS Account Setup
1. Ensure you have an AWS account with administrative access
2. Install and configure AWS CLI:
   ```bash
   # Install AWS CLI (Windows)
   msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

   # Install AWS CLI (macOS)
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /

   # Configure AWS CLI
   aws configure
   # Enter your:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region (e.g., us-east-1)
   # - Default output format (json)
   ```

### 1.2 Required Tools
1. Python 3.9 or later
2. pip (Python package manager)
3. Git (for version control)
4. Code editor (VS Code recommended)
5. PostgreSQL client (for testing)

### 1.3 Network Prerequisites
1. VPC with at least two subnets in different availability zones
2. Internet Gateway attached to VPC
3. NAT Gateway (for Lambda function internet access)
4. Route tables configured properly

## 2. AWS Lambda Setup

### 2.1 Create Lambda Deployment Package

1. Create project directory:
```bash
mkdir resume-pii-api
cd resume-pii-api
```

2. Create virtual environment:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# Activate virtual environment (Unix/macOS)
source venv/bin/activate
```

3. Create `requirements.txt`:
```txt
pg8000==1.30.5
python-json-logger==2.0.7
```

4. Create `lambda_function.py`:
```python
import json
import pg8000
import os
from typing import Dict, Any
import uuid
import logging
from pythonjsonlogger import jsonlogger

# Configure logging
logger = logging.getLogger()
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

def create_db_connection():
    """Create a connection to the PostgreSQL database"""
    try:
        conn = pg8000.connect(
            host=os.environ['DB_HOST'],
            user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'],
            database=os.environ['DB_NAME'],
            port=int(os.environ['DB_PORT']),
            ssl_context=True
        )
        return conn
    except Exception as e:
        logger.error("Database connection error", extra={
            'error': str(e),
            'host': os.environ['DB_HOST'],
            'database': os.environ['DB_NAME']
        })
        raise

def validate_uuid(uuid_string: str) -> bool:
    """Validate if a string is a valid UUID"""
    try:
        uuid_obj = uuid.UUID(uuid_string)
        return str(uuid_obj) == uuid_string
    except ValueError:
        return False

def create_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Create a standardized API response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': True,
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler function"""
    logger.info("Processing request", extra={'event': event})
    
    try:
        # Verify authentication (if present)
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        username = claims.get('cognito:username')
        
        # Skip auth check for direct Lambda testing
        if 'requestContext' in event and not username:
            logger.warning("Unauthorized access attempt")
            return create_response(401, {
                'success': False,
                'error': 'Unauthorized access'
            })

        # Get and validate resume_id
        resume_id = event.get('pathParameters', {}).get('resumeId')
        if not resume_id or not validate_uuid(resume_id):
            logger.warning("Invalid resume ID", extra={'resume_id': resume_id})
            return create_response(400, {
                'success': False,
                'error': 'Invalid resume ID format'
            })

        # Connect to database
        conn = create_db_connection()
        
        # Execute query
        query = """
            SELECT 
                resume_id,
                name,
                email,
                phone_number,
                address,
                linkedin_url,
                s3_bucket,
                s3_key,
                original_filename,
                file_type
            FROM resume_pii 
            WHERE resume_id = %s
        """
        
        cursor = conn.cursor()
        cursor.execute(query, (resume_id,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()

        # If no result found
        if not result:
            logger.info("Resume not found", extra={'resume_id': resume_id})
            return create_response(404, {
                'success': False,
                'error': 'Resume not found'
            })

        # Format response data
        data = {
            'resume_id': str(result[0]),
            'name': result[1],
            'email': result[2],
            'phone_number': result[3],
            'address': result[4],
            'linkedin_url': result[5],
            's3_bucket': result[6],
            's3_key': result[7],
            'original_filename': result[8],
            'file_type': result[9]
        }

        logger.info("Successfully retrieved resume data", 
                   extra={'resume_id': resume_id, 'username': username if username else 'direct-lambda'})
        
        return create_response(200, {
            'success': True,
            'data': data
        })

    except Exception as e:
        logger.error("Unexpected error", extra={'error': str(e)})
        return create_response(500, {
            'success': False,
            'error': 'Internal server error'
        })

5. Create deployment package:
```bash
# Create a new directory for the deployment package
mkdir deployment-package
cd deployment-package

# Install dependencies
pip install --target . -r requirements.txt

# Copy your lambda function
cp ../lambda_function.py .

# Create ZIP file (Windows)
powershell Compress-Archive -Path * -DestinationPath ./lambda_deployment.zip -Force

# Create ZIP file (Unix/macOS)
zip -r ../lambda_deployment.zip .
```

### 2.2 Create Lambda Function

1. Create IAM Role:
   - Go to IAM Console
   - Click "Roles" → "Create role"
   - Select "AWS Lambda" as the service
   - Add these policies:
     ```json
     {
         "Version": "2012-10-17",
         "Statement": [
             {
                 "Effect": "Allow",
                 "Action": [
                     "logs:CreateLogGroup",
                     "logs:CreateLogStream",
                     "logs:PutLogEvents"
                 ],
                 "Resource": "arn:aws:logs:*:*:*"
             },
             {
                 "Effect": "Allow",
                 "Action": [
                     "ec2:CreateNetworkInterface",
                     "ec2:DescribeNetworkInterfaces",
                     "ec2:DeleteNetworkInterface"
                 ],
                 "Resource": "*"
             }
         ]
     }
     ```

2. Create Lambda Function:
   - Go to Lambda Console
   - Click "Create function"
   - Choose "Author from scratch"
   - Basic information:
     - Function name: `getResumePiiById`
     - Runtime: Python 3.9
     - Architecture: x86_64
     - Permissions: Use the IAM role created above

3. Configure Lambda Function:
   - Upload the deployment ZIP file
   - Set handler to: `lambda_function.lambda_handler`
   - Configure VPC:
     - Select your VPC
     - Choose subnets with NAT Gateway access
     - Select security group with outbound access
   - Configure memory: 256 MB
   - Configure timeout: 30 seconds
   - Add environment variables:
     ```
     DB_HOST=[your-postgres-host]
     DB_PORT=5432
     DB_NAME=resume_parser
     DB_USER=[your-db-user]
     DB_PASSWORD=[your-db-password]
     ```

## 3. API Gateway Configuration

### 3.1 Create API

1. Go to API Gateway Console:
   - Click "Create API"
   - Choose "REST API" (not private)
   - Click "Build"

2. Initial Setup:
   ```
   API name: resume-pii-api
   Description: API for fetching resume PII data
   Endpoint Type: Regional
   ```

### 3.2 Configure Cognito Authorizer

1. Create Authorizer:
   - Click "Authorizers" → "Create New Authorizer"
   - Configure:
     ```
     Name: resume-cognito-authorizer
     Type: Cognito
     Cognito User Pool: [Your existing User Pool]
     Token Source: Authorization
     ```

### 3.3 Create Resources and Methods

1. Create Resource Structure:
   ```
   /resume
     /pii
       /{resumeId}
   ```

   Steps:
   - Click "Actions" → "Create Resource"
   - For each level:
     ```
     Resource Name: [name]
     Resource Path: [auto-filled]
     Enable API Gateway CORS: Yes
     ```

2. Create GET Method:
   - Select the `/{resumeId}` resource
   - Click "Actions" → "Create Method"
   - Select GET
   - Configure:
     ```
     Integration type: Lambda Function
     Use Lambda Proxy integration: Yes
     Lambda Function: getResumePiiById
     ```

3. Configure Method Request:
   - Authorization: resume-cognito-authorizer
   - Request Validator: Validate query string parameters and headers
   - API Key Required: No

4. Configure Integration Request:
   - Keep default settings with Lambda Proxy integration

5. Configure Method Response:
   - Add response models for each status code:
     ```
     200: application/json
     400: application/json
     401: application/json
     404: application/json
     500: application/json
     ```

### 3.4 Configure CORS

1. Enable CORS:
   - Select the resource
   - Click "Actions" → "Enable CORS"
   - Configure:
     ```
     Access-Control-Allow-Methods: 'GET,OPTIONS'
     Access-Control-Allow-Headers: 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
     Access-Control-Allow-Origin: '*'
     Access-Control-Allow-Credentials: 'true'
     ```

### 3.5 Deploy API

1. Create Stage:
   - Click "Actions" → "Deploy API"
   - Create new stage:
     ```
     Stage name: dev
     Stage description: Development stage
     ```

2. Note the Invoke URL:
   - Format: `https://[api-id].execute-api.[region].amazonaws.com/dev`

## 4. Database Setup

### 4.1 Security Group Configuration

1. Create Security Group for RDS:
   ```
   Name: rds-postgres-sg
   VPC: [Your VPC]
   Inbound Rules:
     - Type: PostgreSQL
     - Protocol: TCP
     - Port: 5432
     - Source: [Lambda Security Group ID]
   ```

### 4.2 Database Schema

1. Connect to your PostgreSQL database
2. Create/Update Schema:
   ```sql
   CREATE TABLE IF NOT EXISTS resume_pii (
       resume_id UUID PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       email VARCHAR(255) NOT NULL,
       phone_number VARCHAR(50),
       address TEXT,
       linkedin_url VARCHAR(255),
       s3_bucket VARCHAR(255) NOT NULL,
       s3_key VARCHAR(255) NOT NULL,
       original_filename VARCHAR(255) NOT NULL,
       file_type VARCHAR(50) NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_resume_pii_email ON resume_pii(email);
   ```

## 5. Testing and Deployment

### 5.1 Lambda Console Testing

The simplest way to test your Lambda function is directly in the AWS console:

1. Create a test event in AWS Lambda console:
```json
{
  "pathParameters": {
    "resumeId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

2. Replace the UUID with a valid resume ID from your database
3. Click "Test" and check the results

For testing with API Gateway integration, use a more complete test event:
```json
{
  "requestContext": {
    "authorizer": {
      "claims": {
        "cognito:username": "testuser"
      }
    }
  },
  "pathParameters": {
    "resumeId": "123e4567-e89b-12d3-a456-426614174000"
  },
  "headers": {
    "Authorization": "test-auth-token"
  }
}
```

### 5.2 API Testing

1. Using curl:
```bash
# Get Cognito token
TOKEN=$(aws cognito-idp initiate-auth \
  --client-id [YOUR_CLIENT_ID] \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=[username],PASSWORD=[password] \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test API
curl -X GET \
  'https://[api-id].execute-api.[region].amazonaws.com/dev/resume/pii/123e4567-e89b-12d3-a456-426614174000' \
  -H "Authorization: $TOKEN"
```

2. Using Postman:
   - Create new request
   - Set method to GET
   - Enter API URL
   - Add headers:
     ```
     Authorization: [Cognito ID Token]
     ```

## 6. Frontend Integration

### 6.1 AWS Amplify Setup

1. Install Amplify:
```bash
npm install aws-amplify
```

2. Configure Amplify:
```javascript
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: '[Your User Pool ID]',
    userPoolWebClientId: '[Your Client ID]',
  },
  API: {
    endpoints: [{
      name: 'resumePiiApi',
      endpoint: 'https://[api-id].execute-api.[region].amazonaws.com/dev',
      region: 'us-east-1'
    }]
  }
});
```

### 6.2 API Integration

```javascript
import { API, Auth } from 'aws-amplify';

const getPIIData = async (resumeId) => {
  try {
    const response = await API.get('resumePiiApi', `/resume/pii/${resumeId}`, {
      headers: {
        Authorization: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`
      }
    });
    return response;
  } catch (error) {
    console.error('Error fetching PII data:', error);
    throw error;
  }
};
```

## 7. Monitoring and Maintenance

### 7.1 CloudWatch Logs

1. View Lambda Logs:
   - Go to CloudWatch Console
   - Navigate to Log Groups
   - Find `/aws/lambda/getResumePiiById`

2. Create Log Metrics:
   - Filter pattern for errors: `"error"`
   - Create metric for:
     - Error count
     - Response times
     - Request count

### 7.2 CloudWatch Alarms

1. Create Error Rate Alarm:
   - Metric: Error count
   - Threshold: > 5 errors in 5 minutes
   - Action: SNS notification

2. Create Latency Alarm:
   - Metric: p90 latency
   - Threshold: > 1000ms
   - Action: SNS notification

### 7.3 API Gateway Dashboard

1. Create Custom Dashboard:
   - 4XX error rate
   - 5XX error rate
   - Integration latency
   - Request count

### 7.4 Maintenance Tasks

1. Regular Updates:
   - Review and update dependencies monthly
   - Rotate database credentials quarterly
   - Review and update IAM policies

2. Backup Strategy:
   - Enable RDS automated backups
   - Configure backup retention period
   - Test restore procedures quarterly

3. Security Maintenance:
   - Regular security group review
   - SSL certificate rotation
   - VPC flow logs monitoring
   - AWS Config rules for compliance

4. Performance Optimization:
   - Review Lambda memory allocation
   - Optimize database queries
   - Monitor connection pooling
   - Review API caching options

## 8. Integration with OpenSearch API

### 8.1 Combined API Architecture

Instead of creating a separate API for PII data, we've integrated the PostgreSQL PII data retrieval directly into the existing OpenSearch Lambda function. This approach provides several benefits:

1. **Single API Endpoint**: Frontend code only needs to make one API call
2. **Reduced Latency**: Eliminates need for multiple API calls
3. **Consolidated Response**: All resume data is returned in a unified format
4. **Simplified Authentication**: Uses existing Cognito authentication

### 8.2 Implementation Details

The integration adds PII data to each resume match in the following steps:

1. After OpenSearch returns the resume matches:
   - Extract all resume IDs from matches
   - Query PostgreSQL to get PII data for all resume IDs in a single query
   - Enrich each match with its corresponding PII data

2. Response Structure:
```json
{
  "statusCode": 200,
  "body": {
    "matches": [
      {
        "resume_id": "123e4567-e89b-12d3-a456-426614174000",
        "skills": { /* skill data */ },
        "experience": { /* experience data */ },
        "education": [ /* education data */ ],
        "positions": [ /* position data */ ],
        "personal_info": {
          "name": "John Doe",
          "email": "john@example.com",
          "phone_number": "+1234567890",
          "address": "123 Street, City",
          "linkedin_url": "https://linkedin.com/in/johndoe"
        },
        "file_info": {
          "s3_bucket": "bucket-name",
          "s3_key": "path/to/resume.pdf",
          "original_filename": "resume.pdf",
          "file_type": "pdf"
        }
      }
      // Additional matches...
    ]
  }
}
```

### 8.3 Environment Variables

Add the following environment variables to your Lambda function:

```
DB_HOST=[your-postgres-host]
DB_PORT=5432 (default)
DB_NAME=resume_parser
DB_USER=[your-db-user]
DB_PASSWORD=[your-db-password]
```

### 8.4 Fallback Behavior

The integration includes graceful fallbacks:

1. If database credentials are missing, the function continues without PII data
2. If a resume ID isn't found in the database, that match won't have PII data
3. Database errors are logged but don't interrupt the main functionality

### 8.5 Security Considerations

1. **Database Access**: The Lambda function requires secure connection to PostgreSQL
2. **Credential Management**: Store database credentials in AWS Secrets Manager (recommended)
3. **Data Encryption**: All PII data is transmitted over SSL/TLS
4. **Access Control**: Apply appropriate IAM policies to restrict Lambda's database access 