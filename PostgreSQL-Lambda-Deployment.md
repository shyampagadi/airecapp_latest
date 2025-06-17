# PostgreSQL Integration Deployment Guide

This guide explains how to deploy the PostgreSQL integration with the OpenSearch resume matching Lambda function.

## Prerequisites

1. AWS account with permissions to modify Lambda functions and environment variables
2. PostgreSQL database with the required schema
3. Network connectivity between the Lambda function and the PostgreSQL database

## Step 1: Install Dependencies

The integration requires the following dependencies:
- `pg8000`: Pure Python PostgreSQL driver
- `python-json-logger`: For structured logging

```bash
# Install dependencies locally
pip install pg8000==1.30.5 python-json-logger==2.0.7

# Install dependencies to a deployment package directory
pip install --target ./deployment-package pg8000==1.30.5 python-json-logger==2.0.7
```

## Step 2: Update Lambda Code

Ensure your Lambda function includes the following key components:

1. **Database Connection Function**:
```python
def create_db_connection():
    """Create a connection to the PostgreSQL database with retry logic"""
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            start_time = time.time()
            
            conn = pg8000.connect(
                host=os.environ['DB_HOST'],
                user=os.environ['DB_USER'],
                password=os.environ['DB_PASSWORD'],
                database=os.environ.get('DB_NAME', 'resume_parser'),
                port=int(os.environ.get('DB_PORT', '5432')),
                ssl_context=True,
                timeout=15
            )
            
            # Test connection
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            
            return conn
            
        except Exception as e:
            # Retry logic
            if attempt == max_retries - 1:
                return None
            
            # Exponential backoff with jitter
            wait_time = (2 ** attempt * retry_delay) + random.uniform(0, 0.5)
            time.sleep(wait_time)
    
    return None
```

2. **PII Data Retrieval Function**:
```python
def get_pii_data(resume_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Get PII data for a list of resume IDs"""
    if not resume_ids:
        return {}
    
    if not os.environ.get('DB_HOST') or not os.environ.get('DB_USER') or not os.environ.get('DB_PASSWORD'):
        return {}
        
    result = {}
    try:
        # Connect to database
        conn = create_db_connection()
        if not conn:
            return {}

        # Build parameterized query
        placeholders = ', '.join(['%s'] * len(resume_ids))
        query = f"""
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
            WHERE resume_id IN ({placeholders})
        """
        
        # Execute query and fetch results
        cursor = conn.cursor()
        try:
            cursor.execute(query, resume_ids)
            rows = cursor.fetchall() or []
        finally:
            cursor.close()
        conn.close()

        # Process results
        for row in rows:
            if not row or len(row) < 10:
                continue
                
            resume_id = str(row[0]) if row[0] is not None else "unknown"
            result[resume_id] = {
                'name': row[1] or "",
                'email': row[2] or "",
                'phone_number': row[3] or "",
                'address': row[4] or "",
                'linkedin_url': row[5] or "",
                'file_info': {
                    's3_bucket': row[6] or "",
                    's3_key': row[7] or "",
                    'original_filename': row[8] or "unknown.pdf",
                    'file_type': row[9] or "pdf"
                }
            }
        
        return result
        
    except Exception:
        return {}
```

3. **Integration with OpenSearch Results**:
```python
# After retrieving OpenSearch results:
resume_ids = [match.get('resume_id') for match in final_results if isinstance(match, dict)]
pii_data = get_pii_data(resume_ids)

# Enrich matches with PII data
for match in final_results:
    resume_id = match.get('resume_id')
    if resume_id in pii_data:
        match['personal_info'] = {
            'name': pii_data[resume_id].get('name'),
            'email': pii_data[resume_id].get('email'),
            'phone_number': pii_data[resume_id].get('phone_number'),
            'address': pii_data[resume_id].get('address'),
            'linkedin_url': pii_data[resume_id].get('linkedin_url')
        }
        match['file_info'] = pii_data[resume_id].get('file_info')
```

## Step 3: Create Deployment Package

Create a Lambda deployment package that includes all required dependencies:

```bash
cd deployment-package
zip -r ../lambda_deployment.zip .
cd ..
zip -g lambda_deployment.zip lambda_function.py
```

## Step 4: Update Lambda Environment Variables

Add the following environment variables to your Lambda function:

| Variable | Description | Example |
|----------|-------------|---------|
| DB_HOST | PostgreSQL server hostname | my-postgres-server.example.com |
| DB_PORT | PostgreSQL server port | 5432 |
| DB_NAME | Database name | resume_parser |
| DB_USER | Database username | lambda_user |
| DB_PASSWORD | Database password | ********* |

You can set these via the AWS Console:
1. Go to the Lambda function
2. Select the "Configuration" tab
3. Click on "Environment variables"
4. Add the variables listed above

## Step 5: Configure Network Access

If your PostgreSQL database is in a VPC:

1. Configure your Lambda to run in the same VPC:
   - Go to the Lambda function
   - Select the "Configuration" tab
   - Click on "VPC"
   - Select the same VPC as your database
   - Select the appropriate subnets and security groups

2. Ensure the security group allows connections to the database:
   - The Lambda security group must be allowed to connect to the database security group on the PostgreSQL port (typically 5432)

## Step 6: Update Lambda Memory and Timeout

Ensure your Lambda has sufficient resources:

1. Go to the Lambda function
2. Select the "Configuration" tab
3. Click on "General configuration"
4. Set "Memory (MB)" to at least 256 MB (512 MB recommended)
5. Set "Timeout" to at least 30 seconds (60 seconds recommended)

## Step 7: Deploy and Test

1. Upload the deployment package to Lambda:
   ```bash
   aws lambda update-function-code \
     --function-name YourFunctionName \
     --zip-file fileb://lambda_deployment.zip
   ```

2. Test the function using the AWS Lambda console:
   - Create a test event that includes a job description
   - Invoke the function with the test event
   - Verify that the results include PII data for each match

3. Monitor for errors:
   - Check CloudWatch Logs for any database connection or query errors
   - Verify that PostgreSQL logs show the connections from Lambda

## Step 8: Database Security Best Practices

1. **Least Privilege**: Create a database user with the minimum required permissions:
   ```sql
   CREATE USER lambda_user WITH PASSWORD 'secure_password';
   GRANT SELECT ON resume_pii TO lambda_user;
   ```

2. **Secure Credentials**: Consider using AWS Secrets Manager:
   ```python
   import boto3
   
   def get_db_credentials():
       client = boto3.client('secretsmanager')
       response = client.get_secret_value(SecretId='PostgreSQL/ResumeParserDB')
       secret = json.loads(response['SecretString'])
       return secret['username'], secret['password']
   ```

3. **SSL Connection**: Always use SSL for database connections:
   ```python
   conn = pg8000.connect(
       # other parameters...
       ssl_context=True
   )
   ```

## Troubleshooting

1. **Connection Issues**:
   - Check if Lambda has network access to the database
   - Verify security group rules allow traffic on port 5432
   - Try connecting from an EC2 instance in the same VPC

2. **Performance Issues**:
   - Increase Lambda memory if queries are slow
   - Enable provisioned concurrency for lower cold start times
   - Add indexes to the resume_id column in the database

3. **Missing Data**:
   - Verify that resume IDs exist in the database
   - Check if the table name and schema match the expected structure
   - Enable enhanced logging to see detailed query information 