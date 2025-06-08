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