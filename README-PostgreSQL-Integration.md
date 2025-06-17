# PostgreSQL Integration with OpenSearch Resume Matching Lambda

This document explains how PostgreSQL database integration was implemented in the AWS Lambda function for resume matching with OpenSearch.

## Overview

The implementation connects the resume matching Lambda to a PostgreSQL database to enrich OpenSearch results with Personally Identifiable Information (PII) data. This allows the API to return complete candidate profiles in a single API call.

## Key Components

### 1. Database Connection Module

- **Connection Method**: Using `pg8000` (pure Python PostgreSQL driver)
- **Connection Function**: `create_db_connection()` 
- **Connection Parameters**:
  - Host: `DB_HOST` environment variable
  - User: `DB_USER` environment variable
  - Password: `DB_PASSWORD` environment variable
  - Database: `DB_NAME` environment variable (default: `resume_parser`)
  - Port: `DB_PORT` environment variable (default: `5432`)
  - SSL: `ssl_context=True` parameter for secure connections
- **Retry Logic**: Implements 3 retries with exponential backoff and jitter

### 2. PII Data Retrieval

- **Function**: `get_pii_data(resume_ids: List[str])`
- **Implementation**: 
  - Takes a list of resume IDs
  - Executes a single batch query with parameterized SQL
  - Returns a dictionary mapping resume IDs to their PII data
- **Data Structure**:
  ```python
  {
    "resume_id": {
      "name": "Candidate Name",
      "email": "candidate@example.com",
      "phone_number": "123-456-7890",
      "address": "123 Main St, City",
      "linkedin_url": "https://linkedin.com/in/candidate",
      "file_info": {
        "s3_bucket": "bucket-name",
        "s3_key": "path/to/resume.pdf",
        "original_filename": "resume.pdf",
        "file_type": "pdf"
      }
    }
  }
  ```

### 3. Integration with OpenSearch Results

- **Process**:
  1. OpenSearch query returns resume matches based on job description
  2. Resume IDs are extracted from matches
  3. PII data is retrieved from PostgreSQL for all matched resumes
  4. Each match is enriched with its corresponding PII data
  5. Final response includes both resume content and PII data

### 4. Fallback Handling

- **Missing Credentials**: Returns empty PII data but continues function execution
- **Database Connection Error**: Logs error and returns empty PII data
- **Missing Resume IDs**: Logs which resume IDs weren't found in the database
- **Incomplete Row Data**: Validates row data before processing

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | PostgreSQL server hostname | - |
| DB_PORT | PostgreSQL server port | 5432 |
| DB_NAME | Database name | resume_parser |
| DB_USER | Database username | - |
| DB_PASSWORD | Database password | - |

## Required Table Structure

The implementation expects a `resume_pii` table with the following structure:

```sql
CREATE TABLE resume_pii (
    resume_id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone_number VARCHAR(50),
    address TEXT,
    linkedin_url VARCHAR(255),
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(255),
    original_filename VARCHAR(255),
    file_type VARCHAR(50)
);
```

## Security Best Practices

1. **Secure Connection**: Uses SSL for database connections (`ssl_context=True`)
2. **Parameterized Queries**: Prevents SQL injection attacks
3. **Credential Management**: 
   - Store credentials as Lambda environment variables
   - Consider using AWS Secrets Manager for enhanced security
4. **Error Handling**: Catches and logs errors without exposing sensitive details

## Performance Considerations

1. **Batch Query**: Uses a single query to retrieve PII data for multiple resume IDs
2. **Connection Pooling**: Not implemented due to Lambda's stateless nature, but could be considered for high-volume scenarios
3. **Timeout Handling**: Sets a 15-second timeout for database connections
4. **Logging**: Includes performance metrics (connection time, query results count)

## Deployment Requirements

1. **Dependencies**: 
   - `pg8000==1.30.5` (pure Python PostgreSQL driver)
   - `python-json-logger==2.0.7` (for structured logging)

2. **Network Configuration**:
   - Lambda must have network access to the PostgreSQL database
   - For VPC-hosted databases, deploy Lambda in the same VPC
   - Configure security groups to allow Lambda to access the database port

## Testing the Integration

1. **Verify database connectivity**:
   ```python
   conn = pg8000.connect(
       host=os.environ['DB_HOST'],
       user=os.environ['DB_USER'],
       password=os.environ['DB_PASSWORD'],
       database=os.environ['DB_NAME'],
       port=int(os.environ['DB_PORT']),
       ssl_context=True
   )
   cursor = conn.cursor()
   cursor.execute("SELECT 1")
   result = cursor.fetchone()
   print(f"Connection test: {result}")
   cursor.close()
   conn.close()
   ```

2. **Validate PII data retrieval**:
   ```python
   resume_ids = ["your-test-resume-id"]
   pii_data = get_pii_data(resume_ids)
   print(f"PII Data: {json.dumps(pii_data, indent=2)}")
   ```

## Troubleshooting

1. **Connection Issues**:
   - Check network connectivity (VPC, security groups)
   - Verify credentials and database existence
   - Ensure SSL is properly configured if required by the database

2. **Missing PII Data**:
   - Verify resume IDs exist in the database
   - Check table name and column names match implementation
   - Look for error logs indicating query failures

3. **Performance Issues**:
   - Increase Lambda memory/timeout if processing large batches
   - Consider indexing the resume_id column in the database
   - Review logs for slow query execution 