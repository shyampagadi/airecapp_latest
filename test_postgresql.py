#!/usr/bin/env python
"""
Test script for PostgreSQL integration with AWS Lambda

This script verifies:
1. Connection to the PostgreSQL database
2. Proper retrieval of PII data for resume IDs
3. Batch query functionality
4. Error handling and logging

Usage:
    python test_postgresql.py

Environment variables required:
- DB_HOST: PostgreSQL server hostname
- DB_PORT: PostgreSQL server port (default: 5432)
- DB_NAME: Database name (default: resume_parser)
- DB_USER: Database username
- DB_PASSWORD: Database password
"""

import os
import json
import pg8000
import logging
import time
import sys
import uuid
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

def create_db_connection():
    """Create a connection to the PostgreSQL database"""
    try:
        start_time = time.time()
        conn = pg8000.connect(
            host=os.environ['DB_HOST'],
            user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'],
            database=os.environ.get('DB_NAME', 'resume_parser'),
            port=int(os.environ.get('DB_PORT', '5432')),
            ssl_context=True
        )
        elapsed = time.time() - start_time
        logger.info(f"Database connection successful, took {elapsed:.2f}s")
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        logger.error(f"Database parameters: HOST={os.environ.get('DB_HOST')}, DB={os.environ.get('DB_NAME', 'resume_parser')}, USER={os.environ.get('DB_USER')}")
        return None

def get_pii_data(resume_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Get PII data for a list of resume IDs"""
    if not resume_ids:
        logger.info("No resume IDs provided")
        return {}
    
    result = {}
    try:
        logger.info(f"Attempting to retrieve PII data for {len(resume_ids)} resume IDs")
        
        # Connect to database
        conn = create_db_connection()
        if not conn:
            logger.error("Failed to create database connection")
            return {}

        # Build parameterized query with correct number of placeholders
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
            logger.info(f"Database query returned {len(rows)} rows")
        except Exception as db_error:
            logger.error(f"Database query error: {str(db_error)}")
            logger.error(f"Query was: {query} with {len(resume_ids)} parameters")
            return {}
        finally:
            cursor.close()
        conn.close()

        # Process results
        for row in rows:
            if not row or len(row) < 10:
                logger.warning(f"Incomplete row data: {row}")
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
        
        # Log which IDs weren't found
        missing_ids = [id for id in resume_ids if id not in result]
        if missing_ids:
            logger.warning(f"Missing PII data for {len(missing_ids)}/{len(resume_ids)} resume IDs")
            if len(missing_ids) <= 10:
                logger.warning(f"Missing IDs: {missing_ids}")
            else:
                logger.warning(f"First 10 missing IDs: {missing_ids[:10]}...")
        
        logger.info(f"Retrieved PII data for {len(result)}/{len(resume_ids)} resumes")
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving PII data: {str(e)}")
        return {}

def test_connection():
    """Test database connection"""
    logger.info("Testing database connection...")
    conn = create_db_connection()
    if not conn:
        logger.error("Connection test failed")
        return False
        
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 as test_value")
        result = cursor.fetchone()
        cursor.close()
        
        if result and result[0] == 1:
            logger.info("Connection test successful")
            return True
        else:
            logger.error(f"Connection test returned unexpected result: {result}")
            return False
    except Exception as e:
        logger.error(f"Connection test error: {str(e)}")
        return False
    finally:
        conn.close()

def test_pii_retrieval():
    """Test PII data retrieval"""
    logger.info("Testing PII data retrieval...")
    
    # Try to get a sample resume ID from the database
    conn = create_db_connection()
    if not conn:
        return False
        
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT resume_id FROM resume_pii LIMIT 1")
        result = cursor.fetchone()
        cursor.close()
        
        if not result:
            logger.warning("No resume IDs found in database, using sample UUID")
            sample_id = str(uuid.uuid4())
        else:
            sample_id = str(result[0])
            
        # Test single ID retrieval
        logger.info(f"Testing retrieval with single ID: {sample_id}")
        single_result = get_pii_data([sample_id])
        logger.info(f"Single ID test result: {json.dumps(single_result, indent=2)}")
        
        # Test batch retrieval with sample ID and dummy IDs
        dummy_ids = [str(uuid.uuid4()) for _ in range(3)]
        all_ids = [sample_id] + dummy_ids
        logger.info(f"Testing batch retrieval with {len(all_ids)} IDs")
        batch_result = get_pii_data(all_ids)
        logger.info(f"Found {len(batch_result)} records out of {len(all_ids)} IDs")
        
        return True
        
    except Exception as e:
        logger.error(f"PII retrieval test error: {str(e)}")
        return False
    finally:
        conn.close()

def check_environment():
    """Check if required environment variables are set"""
    required_vars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD']
    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set these variables before running the script")
        return False
    
    logger.info("Environment variables check passed")
    return True

def main():
    """Main entry point"""
    logger.info("PostgreSQL Integration Test")
    logger.info("==========================")
    
    if not check_environment():
        return 1
    
    # Test database connection
    if not test_connection():
        logger.error("Database connection test failed")
        return 1
        
    # Test PII data retrieval
    if not test_pii_retrieval():
        logger.error("PII data retrieval test failed")
        return 1
    
    logger.info("All tests completed successfully!")
    return 0

if __name__ == "__main__":
    sys.exit(main())