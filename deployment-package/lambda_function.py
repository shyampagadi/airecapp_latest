"""
AWS Lambda handler for resume matching API.

This module provides a serverless implementation that connects to API Gateway,
accepting job descriptions as input and returning matched resume IDs from OpenSearch.

Model Usage:
- BEDROCK_EMBEDDINGS_MODEL: Used exclusively for generating vector embeddings
  (typically amazon.titan-embed-text-v2:0)
- MODEL_ID (accessed via BEDROCK_MODEL_ID): Used exclusively for LLM-based parsing and analysis
  (typically anthropic.claude-*, meta.llama-*, etc.)

Key Functions:
- lambda_handler: Main entry point for AWS Lambda
- vector_search: Performs semantic search with optional reranking
- generate_embedding: Creates vector embeddings for text using BEDROCK_EMBEDDINGS_MODEL
- analyze_jd: Extracts structured information from job descriptions using MODEL_ID
- extract_skills_llm: Extracts skills from text using MODEL_ID
- extract_jd_info_llm: Extracts comprehensive JD info using MODEL_ID
"""
import json
import os
import math
import boto3
from datetime import datetime, timedelta
import logging
import re
from typing import Dict, Any, List, Optional, Union
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
from requests_aws4auth import AWS4Auth
import hashlib
import time
import random
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import pg8000
import uuid

# VERY DISTINCTIVE START MARKER
# print("!!!!!! LAMBDA LOADING - V5-SUPER-DIAGNOSTIC-MODE !!!!!!")
# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.WARNING)  # Change to WARNING to reduce noise

# Comment out super distinctive logging
# logger.info("****************************************************************")
# logger.info("***  LAMBDA INITIALIZING - V5-SUPER-DIAGNOSTIC-MODE - 2025-05-29  ***")
# logger.info("****************************************************************")

# Validate required environment variables
def validate_environment():
    """Validate required environment variables are present"""
    required_vars = [
        'OPENSEARCH_ENDPOINT',
        'OPENSEARCH_INDEX',
        'OPENSEARCH_REGION'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.environ.get(var):
            missing_vars.append(var)
            
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    # Log warning if MODEL_ID is missing
    if not os.environ.get('MODEL_ID'):
        logger.warning("MODEL_ID environment variable not set - LLM functionality will use fallbacks")
    
    # Log warning if BEDROCK_EMBEDDINGS_MODEL is not set
    if not os.environ.get('BEDROCK_EMBEDDINGS_MODEL'):
        logger.warning("BEDROCK_EMBEDDINGS_MODEL not set, using default: amazon.titan-embed-text-v2:0")
    
    # Log configuration details to help with debugging
    logger.info(f"OpenSearch Configuration:")
    logger.info(f"- Endpoint: {os.environ.get('OPENSEARCH_ENDPOINT')}")
    logger.info(f"- Index: {os.environ.get('OPENSEARCH_INDEX')}")
    logger.info(f"- Region: {os.environ.get('OPENSEARCH_REGION')}")
    logger.info(f"- Serverless: {os.environ.get('OPENSEARCH_SERVERLESS', 'false').lower() == 'true'}")
    logger.info(f"Bedrock Configuration:")
    logger.info(f"- Embedding Model: {os.environ.get('BEDROCK_EMBEDDINGS_MODEL', 'amazon.titan-embed-text-v2:0')}")
    logger.info(f"- LLM Model: {os.environ.get('MODEL_ID', 'Not set')}")
    
    logger.info("Environment variables validated")
    
# Validate environment on module load
try:
    validate_environment()
except EnvironmentError as e:
    logger.error(f"Environment validation failed: {str(e)}")
    # Don't raise here - let Lambda execution handle the failure case

# OpenSearch configuration
OPENSEARCH_ENDPOINT = os.environ.get('OPENSEARCH_ENDPOINT')
OPENSEARCH_INDEX = os.environ.get('OPENSEARCH_INDEX', 'resume-embeddings')
OPENSEARCH_REGION = os.environ.get('OPENSEARCH_REGION', 'us-east-1')
OPENSEARCH_SERVERLESS = os.environ.get('OPENSEARCH_SERVERLESS', 'false').lower() == 'true'

# Make sure endpoint doesn't include protocol prefix
if OPENSEARCH_ENDPOINT and (OPENSEARCH_ENDPOINT.startswith('https://') or OPENSEARCH_ENDPOINT.startswith('http://')):
    logger.warning("Removing protocol prefix from OpenSearch endpoint")
    OPENSEARCH_ENDPOINT = OPENSEARCH_ENDPOINT.split('://', 1)[1]

logger.info(f"OpenSearch endpoint: {OPENSEARCH_ENDPOINT}")
logger.info(f"OpenSearch index: {OPENSEARCH_INDEX}")

# Bedrock Models - Clear separation of model usage
# BEDROCK_EMBEDDINGS_MODEL is used ONLY for generating embeddings
BEDROCK_EMBEDDINGS_MODEL = os.environ.get('BEDROCK_EMBEDDINGS_MODEL', 'amazon.titan-embed-text-v2:0')
# MODEL_ID (accessed via BEDROCK_MODEL_ID) is used ONLY for LLM-based parsing (JD analysis, skill extraction)
BEDROCK_MODEL_ID = os.environ.get('MODEL_ID')

# Enhance embedding cache with expiry time
_embedding_cache = {}
_embedding_cache_timestamps = {}
_CACHE_EXPIRY_SECONDS = 3600  # Cache expires after 1 hour

# Add analysis cache to avoid redundant LLM calls
_analysis_cache = {}
_analysis_cache_timestamps = {}
_ANALYSIS_CACHE_EXPIRY = 86400  # Analysis cache expires after 1 day

# PostgreSQL configuration
DB_HOST = os.environ.get('DB_HOST')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'resume_parser')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')

def get_aws_credentials():
    """Return AWS credentials for services to use"""
    credentials = {}
    credentials['aws_access_key_id'] = os.environ.get('AWS_ACCESS_KEY_ID')
    credentials['aws_secret_access_key'] = os.environ.get('AWS_SECRET_ACCESS_KEY')
    return credentials

def get_opensearch_client():
    """Create and return an OpenSearch client"""
    max_retries = 3
    retry_delay = 1  # starting delay in seconds
    last_exception = None
    
    # Only log essential environment variables - remove the verbose logging
    logger.info("OpenSearch Configuration:")
    logger.info(f"- Endpoint: {os.environ.get('OPENSEARCH_ENDPOINT')}")
    logger.info(f"- Index: {os.environ.get('OPENSEARCH_INDEX')}")
    logger.info(f"- Serverless: {OPENSEARCH_SERVERLESS}")
    
    for attempt in range(max_retries):
        try:
            if OPENSEARCH_SERVERLESS:
                service = 'aoss'
                logger.info(f"Using 'aoss' service name for OpenSearch Serverless")
            else:
                service = 'es'
                logger.info(f"Using 'es' service name for standard OpenSearch")
            
            # Create AWS auth for OpenSearch
            session = boto3.Session()
            credentials = session.get_credentials()
            
            if credentials is None:
                logger.error("AWS credentials not available - cannot authenticate to OpenSearch")
                raise ValueError("No AWS credentials available")
            
            auth = AWS4Auth(
                credentials.access_key,
                credentials.secret_key,
                OPENSEARCH_REGION,
                service,
                session_token=credentials.token
            )
            
            # Extract the domain name from the endpoint if it's a full URL
            host = OPENSEARCH_ENDPOINT
            if '://' in host:
                host = host.split('://', 1)[1]
            
            # Create OpenSearch client
            logger.info(f"Creating OpenSearch client with host: {host}")
            client = OpenSearch(
                hosts=[{'host': host, 'port': 443}],
                http_auth=auth,
                use_ssl=True,
                verify_certs=True,
                connection_class=RequestsHttpConnection,
                retry_on_timeout=True,
                max_retries=3,
                timeout=30
            )
            
            # Test specific index availability directly rather than general health checks
            try:
                # Check if the index exists directly
                logger.info(f"Verifying index existence: {OPENSEARCH_INDEX}")
                index_exists = client.indices.exists(index=OPENSEARCH_INDEX)
                
                if index_exists:
                    logger.info(f"Successfully verified index exists: {OPENSEARCH_INDEX}")
                    return client
                else:
                    logger.error(f"Index does not exist: {OPENSEARCH_INDEX}")
                    raise ValueError(f"Index {OPENSEARCH_INDEX} not found")
                    
            except Exception as idx_error:
                logger.warning(f"Index check failed: {str(idx_error)}")
                
                # Try direct HTTP request to root endpoint as fallback
                try:
                    logger.info("Trying direct HTTP GET request to '/'")
                    raw_response = client.transport.perform_request(
                        'GET',
                        '/'
                    )
                    logger.info(f"Connection successful, but index may not exist")
                    return client
                except Exception as direct_error:
                    logger.warning(f"Direct HTTP request failed: {str(direct_error)}")
                    raise direct_error
            
        except Exception as e:
            last_exception = e
            if attempt == max_retries - 1:  # Last attempt
                logger.error(f"All {max_retries} OpenSearch connection attempts failed: {str(e)}")
                if "404" in str(e):
                    logger.error(f"404 Not Found error - Check that your index '{OPENSEARCH_INDEX}' exists and is accessible")
                    logger.error(f"Make sure OPENSEARCH_ENDPOINT and OPENSEARCH_INDEX environment variables are correct")
                raise e
            
            # Use exponential backoff with jitter
            jitter = random.uniform(0, 0.5)
            wait_time = (2 ** attempt * retry_delay) + jitter
            
            logger.warning(f"OpenSearch connection attempt {attempt+1} failed: {type(e).__name__}: {str(e)}. Retrying in {wait_time:.2f} seconds...")
            time.sleep(wait_time)

def get_bedrock_client():
    """Create and return a Bedrock client"""
    try:
        session = boto3.Session()
        return session.client(
            service_name='bedrock-runtime', 
            region_name=OPENSEARCH_REGION
        )
    except Exception as e:
        logger.error(f"Error creating Bedrock client: {str(e)}")
        # Add specific error handling for common Bedrock issues
        if "AccessDeniedException" in str(e):
            logger.error("Access denied to Bedrock - check IAM permissions")
        elif "ResourceNotFoundException" in str(e):
            logger.error("Bedrock resource not found - check region and model availability")
        raise e

def normalize_skill(skill: str) -> str:
    """Normalize skill name to handle variations"""
    skill = skill.lower().strip()
    
    # Handle common skill variations and abbreviations
    skill_mapping = {
        'js': 'javascript',
        'react.js': 'react',
        'reactjs': 'react',
        'node.js': 'node',
        'nodejs': 'node',
        'vue.js': 'vue',
        'vuejs': 'vue',
        'py': 'python',
        'aws cloud': 'aws',
        'amazon web services': 'aws',
        'azure cloud': 'azure',
        'ms azure': 'azure',
        'google cloud': 'gcp',
        'google cloud platform': 'gcp',
        'k8s': 'kubernetes',
        'next.js': 'nextjs',
        'postgres': 'postgresql',
        'mongo': 'mongodb',
        'ts': 'typescript',
    }
    
    return skill_mapping.get(skill, skill)

def extract_skills_pattern_matching(job_description: str) -> List[str]:
    """Extract skills from job description using pattern matching"""
    # Common tech skills dictionary - more comprehensive than the basic one in original code
    common_skills = [
        "python", "java", "javascript", "react", "angular", "node", "aws",
        "azure", "gcp", "docker", "kubernetes", "sql", "nosql", "mongodb",
        "postgresql", "mysql", "oracle", "rest", "api", "microservices",
        "ci/cd", "devops", "agile", "scrum", "git", "machine learning", "ai",
        "data science", "big data", "hadoop", "spark", "tableau", "power bi",
        "excel", "word", "powerpoint", "jira", "confluence", "linux", "unix",
        "windows", "c#", "c++", "ruby", "php", "html", "css", "sass", "less",
        "typescript", "vue", "redux", "graphql", "django", "flask", "spring",
        "hibernate", "jenkins", "terraform", "ansible", "puppet", "chef",
        "blockchain", "ethereum", "solidity", "ios", "android", "swift",
        "kotlin", "react native", "flutter", "xamarin", "unity", "unreal",
        "sap", "salesforce", "dynamics", "sharepoint", "azure devops",
        "aws lambda", "serverless", "kafka", "rabbitmq", "redis", "elasticsearch",
        "kibana", "logstash", "grafana", "prometheus", "datadog", "new relic",
        "splunk", "sumo logic", "nginx", "apache", "tomcat", "iis", "weblogic",
        "websphere", "jboss", "wildfly", "maven", "gradle", "npm", "yarn",
        "webpack", "babel", "jest", "mocha", "cypress", "selenium", "appium",
        "junit", "testng", "nunit", "xunit", "pytest", "rspec", "cucumber"
    ]
    
    # Extract skills from job description
    jd_lower = job_description.lower()
    found_skills = []
    
    for skill in common_skills:
        if skill in jd_lower:
            found_skills.append(skill)
    
    return found_skills

def create_standardized_text(data: Dict[str, Any]) -> str:
    """
    Create a standardized text representation for embedding generation
    Similar to the function in bedrock_embeddings.py
    """
    # Extract skills
    skills = data.get('skills', [])
    if isinstance(skills, str):
        skills_text = skills
    elif isinstance(skills, list):
        skills_text = ", ".join(skills)
    else:
        skills_text = ""
    
    # Extract required skills for JDs
    if 'required_skills' in data and data['required_skills']:
        if skills_text:
            skills_text += ", "
        if isinstance(data['required_skills'], list):
            skills_text += ", ".join(data['required_skills'])
        else:
            skills_text += str(data['required_skills'])
    
    # Extract experience
    experience = ""
    if 'total_experience' in data:
        experience = f"{data.get('total_experience')} years"
    elif 'required_experience' in data:
        experience = f"{data.get('required_experience')} years"
    
    # Extract job title if it exists (for JDs)
    positions_text = ""
    if 'job_title' in data:
        positions_text = data['job_title']
    
    # Extract summary
    summary = data.get('summary', '')
    if isinstance(summary, dict) and 'text' in summary:
        summary = summary['text']
    
    # Create standardized text
    common_template = """Skills: {skills}
Experience: {experience}
Position: {positions}
Summary: {summary}"""

    standardized_text = common_template.format(
        skills=skills_text,
        experience=experience,
        positions=positions_text,
        summary=summary
    )
    
    return standardized_text

def extract_skills_llm(job_description: str) -> List[str]:
    """Extract skills from job description using LLM"""
    try:
        # Use ONLY the LLM model (MODEL_ID) for skill extraction
        bedrock = get_bedrock_client()
        model_id = BEDROCK_MODEL_ID
        
        # If no model ID is provided, fall back to pattern matching
        if not model_id:
            logger.warning("No MODEL_ID provided, falling back to pattern matching")
            return extract_skills_pattern_matching(job_description)
        
        # Craft prompt for skill extraction
        prompt = f"""You are a skilled technical recruiter with expertise in identifying technical skills from job descriptions.
        
        Extract all technical skills, tools, technologies, frameworks, programming languages, and domain knowledge 
        from the following job description. Return ONLY a JSON array of strings containing the skills.
        Only include specific skills, not general concepts or responsibilities.
        
        Job Description:
        {job_description}
        """
        
        # Call Bedrock model with model-specific parameters
        request_body = {}
        
        # Adapt request format by model
        if "claude" in model_id.lower():
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "temperature": 0.1,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }
        elif "titan" in model_id.lower():
            request_body = {
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": 1000,
                    "temperature": 0.1
                }
            }
        elif "llama" in model_id.lower():
            request_body = {
                "prompt": prompt,
                "max_gen_len": 1000,
                "temperature": 0.1
            }
        else:
            # Default format for other models
            request_body = {
                "prompt": prompt,
                "max_tokens_to_sample": 1000,
                "temperature": 0.1
            }
            
        # Call Bedrock model
        logger.info(f"Calling Bedrock LLM model (MODEL_ID): {model_id} for skill extraction")
        response = bedrock.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body)
        )
        
        # Parse response based on model type
        response_body = json.loads(response.get("body").read())
        completion = ""
        
        if "claude" in model_id.lower() and "content" in response_body:
            completion = response_body.get("content", [{}])[0].get("text", "")
        elif "llama" in model_id.lower():
            completion = response_body.get("generation", "")
        elif "titan" in model_id.lower():
            completion = response_body.get("results", [{}])[0].get("outputText", "")
        else:
            completion = response_body.get("completion", "")
        
        logger.debug(f"LLM response: {completion[:100]}...")
        
        # Extract JSON array from completion
        skills_match = re.search(r'\[(.*?)\]', completion, re.DOTALL)
        if skills_match:
            skills_json = f"[{skills_match.group(1)}]"
            try:
                # Clean up the JSON string
                skills_json = skills_json.replace("'", '"')
                skills_json = re.sub(r',\s*]', ']', skills_json)
                skills = json.loads(skills_json)
                return [skill.strip() for skill in skills if skill.strip()]
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse skills JSON: {str(e)}")
        
        # Try a more aggressive approach to extract any array-like structure
        any_skills = re.findall(r'"([^"]+)"', completion)
        if any_skills:
            logger.info(f"Extracted {len(any_skills)} skills using regex fallback")
            return [skill.strip() for skill in any_skills if skill.strip()]
                
    except Exception as e:
        logger.error(f"Error extracting skills with LLM: {str(e)}")
    
    # If we couldn't extract skills, return empty list
    return []

def extract_skills_from_jd(job_description: str) -> List[str]:
    """Extract skills from job description using LLM with pattern matching as fallback"""
    try:
        # Try LLM-based extraction first
        skills = extract_skills_llm(job_description)
        if skills:
            logger.info(f"Successfully extracted {len(skills)} skills using LLM")
            return skills
    except Exception as e:
        logger.error(f"LLM skill extraction failed: {str(e)}")
    
    # Fall back to pattern matching
    logger.info("Falling back to pattern matching for skill extraction")
    return extract_skills_pattern_matching(job_description)

def extract_jd_info_llm(job_description: str) -> Dict[str, Any]:
    """Extract comprehensive information from job description using LLM
    
    Uses MODEL_ID (via BEDROCK_MODEL_ID) for LLM-based analysis.
    
    Args:
        job_description: Job description text
        
    Returns:
        Dictionary with extracted information or fallback data
    """
    # Default fallback info - pre-defined structure for consistent return values
    default_info = {
        "job_title": "Not specified",
        "required_experience": 0,
        "required_skills": extract_skills_pattern_matching(job_description),
        "nice_to_have_skills": []
    }
    
    # Extract job title using regex as fallback
    title_match = re.search(r'^([^.:\n]{5,100})', job_description)
    if title_match:
        default_info['job_title'] = title_match.group(1).strip()
    
    # Extract required experience using regex as fallback
    experience_match = re.search(r'(\d+)(?:\s*[-+]?\s*\d*)?\s+years?\s+(?:of\s+)?experience', job_description, re.IGNORECASE)
    if experience_match:
        default_info['required_experience'] = int(experience_match.group(1))
    
    # Skip LLM if MODEL_ID is not provided
    if not BEDROCK_MODEL_ID:
        logger.warning("No MODEL_ID provided for LLM analysis, using pattern matching")
        return default_info
    
    try:
        bedrock = get_bedrock_client()
        model_id = BEDROCK_MODEL_ID
        
        # Craft prompt for JD information extraction
        prompt = f"""You are an expert job description analyzer. Extract the following information from the job description below:

1. Job Title
2. Required Years of Experience (as a number only)
3. Required Skills (as a list)
4. Nice-to-Have Skills (as a list)
5. Seniority Level (e.g., Junior, Mid-level, Senior, Lead)
6. Job Type (e.g., Full-time, Contract, Remote)
7. Industry
8. Required Education (e.g., Bachelor's, Master's)

Return ONLY a valid JSON object with the following format (no other text):
{{
  "job_title": "string",
  "required_experience": number,
  "required_skills": ["skill1", "skill2"],
  "nice_to_have_skills": ["skill1", "skill2"],
  "seniority_level": "string",
  "job_type": "string",
  "industry": "string", 
  "required_education": "string"
}}

Make sure:
- All keys are double-quoted
- required_experience is a number (not a string)
- All arrays use square brackets
- No trailing commas
- All strings are properly quoted with double quotes

Job Description:
{job_description}
"""
        
        # Prepare request body based on model type
        if "claude" in model_id.lower():
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "temperature": 0.1,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }
        elif "titan" in model_id.lower():
            request_body = {
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": 1000,
                    "temperature": 0.1
                }
            }
        elif "llama" in model_id.lower():
            # Llama models use a different parameter format
            request_body = {
                "prompt": prompt,
                "max_gen_len": 1000,
                "temperature": 0.1
            }
        else:
            # Default format for other models
            request_body = {
                "prompt": prompt,
                "max_tokens_to_sample": 1000,
                "temperature": 0.1
            }
        
        # Call Bedrock LLM model
        logger.info(f"Calling Bedrock LLM model (MODEL_ID): {model_id} for JD analysis")
        response = bedrock.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body)
        )
        
        # Parse response based on model type
        response_body = json.loads(response.get("body").read())
        completion = ""
        
        if "claude" in model_id.lower() and "content" in response_body:
            completion = response_body.get("content", [{}])[0].get("text", "")
        elif "llama" in model_id.lower():
            # Llama models return 'generation' field
            completion = response_body.get("generation", "")
        elif "titan" in model_id.lower():
            completion = response_body.get("results", [{}])[0].get("outputText", "")
        else:
            # Default to completion field
            completion = response_body.get("completion", "")
        
        # Extract JSON from the completion
        json_match = re.search(r'\{[\s\S]*\}', completion, re.DOTALL)
        
        if json_match:
            json_str = json_match.group(0)
            try:
                jd_info = json.loads(json_str)
                logger.info(f"Successfully extracted JD info using LLM")
                
                # Merge with default info to ensure all fields exist
                # This ensures we have pattern-matched fallbacks for any missing values
                merged_info = default_info.copy()
                
                # Update with LLM-extracted values if they exist
                if 'job_title' in jd_info and jd_info['job_title']:
                    merged_info['job_title'] = jd_info['job_title']
                    
                if 'required_experience' in jd_info and jd_info['required_experience']:
                    merged_info['required_experience'] = jd_info['required_experience']
                    
                if 'required_skills' in jd_info and jd_info['required_skills']:
                    merged_info['required_skills'] = jd_info['required_skills']
                    
                if 'nice_to_have_skills' in jd_info and jd_info['nice_to_have_skills']:
                    merged_info['nice_to_have_skills'] = jd_info['nice_to_have_skills']
                    
                if 'seniority_level' in jd_info:
                    merged_info['seniority_level'] = jd_info['seniority_level']
                    
                if 'job_type' in jd_info:
                    merged_info['job_type'] = jd_info['job_type']
                    
                if 'industry' in jd_info:
                    merged_info['industry'] = jd_info['industry']
                    
                if 'required_education' in jd_info:
                    merged_info['required_education'] = jd_info['required_education']
                
                return merged_info
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JD info JSON from LLM response: {str(e)}")
                logger.debug(f"Problematic JSON: {json_str}")
                # Return fallback info
                return default_info
        else:
            logger.warning("Could not find JSON object in LLM response")
            # Return fallback info
            return default_info
                
    except Exception as e:
        logger.error(f"Error extracting JD info using LLM: {str(e)}")
        # Return fallback info
        return default_info

def analyze_jd(jd_text):
    """Analyze job description to extract structured information
    
    Uses MODEL_ID (via BEDROCK_MODEL_ID) for LLM-based analysis.
    """
    try:
        # Try to use LLM for detailed extraction - this uses MODEL_ID not the embedding model
        jd_info = extract_jd_info_llm(jd_text)
        
        # If LLM extraction provided some data, use it
        if jd_info and isinstance(jd_info, dict) and len(jd_info) > 0:
            # If no required experience found, try to extract it with regex
            if 'required_experience' not in jd_info or not jd_info['required_experience']:
                experience_match = re.search(r'(\d+)(?:\s*[-+]?\s*\d*)?\s+years?\s+(?:of\s+)?experience', jd_text, re.IGNORECASE)
                if experience_match:
                    jd_info['required_experience'] = int(experience_match.group(1))
                else:
                    jd_info['required_experience'] = 0
                    
            # If no skills found, try pattern matching
            if 'required_skills' not in jd_info or not jd_info['required_skills']:
                jd_info['required_skills'] = extract_skills_pattern_matching(jd_text)
                
            # If no job title found, try to extract it
            if 'job_title' not in jd_info or not jd_info['job_title']:
                title_match = re.search(r'^([^.:\n]{5,100})', jd_text)
                if title_match:
                    jd_info['job_title'] = title_match.group(1).strip()
                else:
                    jd_info['job_title'] = "Not specified"
            
            return jd_info
    except Exception as e:
        logger.warning(f"Error analyzing JD with LLM: {str(e)}")
    
    # Fallback to regex-based extraction
    logger.info("Using fallback regex-based JD analysis")
    default_info = {
        "job_title": "Not specified",
        "required_experience": 0,
        "required_skills": [],
        "nice_to_have_skills": []
    }
    
    # Extract job title using regex
    title_match = re.search(r'^([^.:\n]{5,100})', jd_text)
    if title_match:
        default_info['job_title'] = title_match.group(1).strip()
    
    # Extract required experience using regex
    experience_match = re.search(r'(\d+)(?:\s*[-+]?\s*\d*)?\s+years?\s+(?:of\s+)?experience', jd_text, re.IGNORECASE)
    if experience_match:
        default_info['required_experience'] = int(experience_match.group(1))
    
    # Extract skills using pattern matching
    default_info['required_skills'] = extract_skills_pattern_matching(jd_text)
    
    return default_info

def calculate_skill_match_score(resume_skills: List[str], jd_skills: List[str]) -> float:
    """
    Calculate skill match score between resume and job description
    
    Args:
        resume_skills: List of skills from resume
        jd_skills: List of skills from job description
        
    Returns:
        Skill match score (0-100)
    """
    if not resume_skills or not jd_skills:
        return 0.0
    
    # Normalize skills (lowercase and handle variations)
    resume_skills_norm = [normalize_skill(skill) for skill in resume_skills]
    jd_skills_norm = [normalize_skill(skill) for skill in jd_skills]
    
    # Count exact matches using normalized skills
    exact_matches = sum(1 for skill in jd_skills_norm if skill in resume_skills_norm)
    
    # Calculate partial matches with improved logic
    partial_matches = 0
    for jd_skill in jd_skills_norm:
        if jd_skill not in resume_skills_norm:
            # Check for substring matches (both directions)
            for resume_skill in resume_skills_norm:
                # Only consider meaningful substrings (at least 4 chars)
                if len(jd_skill) >= 4 and len(resume_skill) >= 4:
                    # Check if JD skill is part of resume skill
                    if jd_skill in resume_skill:
                        partial_matches += 0.75  # Higher weight for substring match
                        break
                    # Check if resume skill is part of JD skill
                    elif resume_skill in jd_skill:
                        partial_matches += 0.5  # Medium weight for this case
                        break
                    # Check for significant word overlap in multi-word skills
                    elif ' ' in jd_skill and ' ' in resume_skill:
                        jd_words = set(jd_skill.split())
                        resume_words = set(resume_skill.split())
                        common_words = jd_words.intersection(resume_words)
                        if len(common_words) >= 2 or (len(common_words) == 1 and len(jd_words) <= 2):
                            partial_matches += 0.5  # Medium weight for word overlap
                            break
    
    # Calculate total score with partial matches
    total_matches = exact_matches + partial_matches
    
    # Calculate score - weight exact matches more heavily
    weighted_score = (total_matches / len(jd_skills_norm) * 100) if jd_skills_norm else 0
    
    # Bonus for high coverage of critical skills
    if jd_skills_norm and exact_matches >= len(jd_skills_norm) * 0.7:
        weighted_score *= 1.15  # 15% bonus for covering 70%+ of required skills
        weighted_score = min(weighted_score, 100)  # Cap at 100
    
    return round(weighted_score, 2)

def calculate_experience_match(resume_exp: float, jd_required_exp: float) -> float:
    """
    Calculate experience match score
    
    Args:
        resume_exp: Years of experience in resume
        jd_required_exp: Years of experience required in job description
        
    Returns:
        Experience match score (0-100)
    """
    if resume_exp >= jd_required_exp:
        return 100.0
    
    # Partial match
    return round((resume_exp / jd_required_exp) * 100, 2) if jd_required_exp > 0 else 0

def generate_embedding(text):
    """Generate embedding for the given text using AWS Bedrock"""
    try:
        # Implement a quick hash for text to handle minor variations
        normalized_text = ' '.join(text.lower().split())  # Simple normalization
        cache_key = hashlib.md5(normalized_text.encode()).hexdigest()
        current_time = time.time()
        
        # Check if embedding is cached and not expired
        if (cache_key in _embedding_cache and 
            cache_key in _embedding_cache_timestamps and 
            current_time - _embedding_cache_timestamps[cache_key] < _CACHE_EXPIRY_SECONDS):
            logger.debug("Using cached embedding")
            return _embedding_cache[cache_key]
        
        # Use ONLY the embedding model for generating embeddings
        bedrock = get_bedrock_client()
        model_id = BEDROCK_EMBEDDINGS_MODEL
        
        # Use the correct request format based on the model
        # For amazon.titan-embed-text models
        if "titan-embed-text-v2" in model_id.lower():
            request_body = {
                "inputText": text,
                "dimensions": 1024  # Pass dimension parameter correctly
            }
        elif "titan-embed" in model_id.lower():
            request_body = {
                "inputText": text
            }
        # For anthropic.claude-3 models
        elif "claude" in model_id.lower():
            request_body = {
                "input_text": text,
                "embedding_model": "default" 
            }
        # For cohere models
        elif "cohere" in model_id.lower():
            request_body = {
                "texts": [text],
                "input_type": "search_document"
            }
        else:
            # Default to Titan format
            request_body = {
                "inputText": text
            }
        
        # Call the model
        logger.info(f"Calling Bedrock embedding model: {model_id}")
        response = bedrock.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response.get('body').read())
        
        # Handle response format based on the model
        if "titan-embed" in model_id.lower():
            embedding = response_body.get('embedding')
        elif "claude" in model_id.lower():
            embedding = response_body.get('embedding')
        elif "cohere" in model_id.lower():
            embedding = response_body.get('embeddings')[0]
        else:
            embedding = response_body.get('embedding', [])
        
        # Cache the embedding with timestamp
        _embedding_cache[cache_key] = embedding
        _embedding_cache_timestamps[cache_key] = current_time
        
        logger.info(f"Successfully generated embedding with {len(embedding) if embedding else 0} dimensions")
        return embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise e

def create_focused_search_query(job_description: str, jd_info: Dict[str, Any]) -> str:
    """
    Create a focused search query from job description for better vector search results
    
    Args:
        job_description: Original job description
        jd_info: Extracted JD information
        
    Returns:
        Focused query text optimized for vector search
    """
    # Create a focused query combining key elements from the JD
    query_parts = []
    
    # Add job title
    if jd_info.get('job_title'):
        query_parts.append(f"Job Title: {jd_info.get('job_title')}")
    
    # Add required skills
    if jd_info.get('required_skills'):
        query_parts.append(f"Required Skills: {', '.join(jd_info.get('required_skills'))}")
    
    # Add nice-to-have skills
    if jd_info.get('nice_to_have_skills'):
        query_parts.append(f"Nice-to-have Skills: {', '.join(jd_info.get('nice_to_have_skills'))}")
    
    # Add seniority level
    if jd_info.get('seniority_level'):
        query_parts.append(f"Seniority Level: {jd_info.get('seniority_level')}")
    
    # Add industry
    if jd_info.get('industry'):
        query_parts.append(f"Industry: {jd_info.get('industry')}")
    
    # If we have enough extracted info, use the focused query
    if len(query_parts) >= 3:
        return "\n".join(query_parts)
    
    # Fallback to using the original job description
    return job_description

def create_db_connection():
    """Create a connection to the PostgreSQL database with retry logic"""
    max_retries = 3
    retry_delay = 1  # starting delay in seconds
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Database connection attempt {attempt+1}/{max_retries}")
            start_time = time.time()
            
            conn = pg8000.connect(
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                port=int(DB_PORT),
                ssl_context=True,
                timeout=15  # Set a reasonable timeout
            )
            
            elapsed = time.time() - start_time
            logger.info(f"Database connection successful, took {elapsed:.2f}s")
            
            # Test the connection with a simple query
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            
        return conn
            
    except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Database connection attempt {attempt+1} failed after {elapsed:.2f}s: {str(e)}")
            
            if attempt == max_retries - 1:  # Last attempt
                logger.error(f"All {max_retries} database connection attempts failed - will return empty results")
                logger.error(f"Database parameters: HOST={DB_HOST}, DB={DB_NAME}, USER={DB_USER}, PORT={DB_PORT}")
                return None
            
            # Calculate exponential backoff with jitter
            jitter = random.uniform(0, 0.5)
            wait_time = (2 ** attempt * retry_delay) + jitter
            
            logger.warning(f"Retrying database connection in {wait_time:.2f} seconds...")
            time.sleep(wait_time)

def validate_uuid(uuid_string: str) -> bool:
    """Validate if a string is a valid UUID"""
    try:
        uuid_obj = uuid.UUID(uuid_string)
        return str(uuid_obj) == uuid_string
    except ValueError:
        return False

def get_pii_data(resume_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Get PII data for a list of resume IDs
    
    Args:
        resume_ids: List of resume IDs to fetch PII data for
        
    Returns:
        Dictionary mapping resume_id to PII data
    """
    if not resume_ids:
        return {}
    
    if not DB_HOST or not DB_USER or not DB_PASSWORD:
        logger.warning("Database credentials not configured, skipping PII data retrieval")
        return {}
        
    result = {}
    try:
        logger.info(f"Attempting to retrieve PII data for {len(resume_ids)} resume IDs")
        logger.info(f"Database connection info: Host={DB_HOST}, DB={DB_NAME}, User={DB_USER}")
        
        # Log the first few resume IDs for debugging
        if resume_ids and len(resume_ids) > 0:
            sample_ids = resume_ids[:min(5, len(resume_ids))]
            logger.info(f"Sample resume IDs being queried: {sample_ids}")

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
        rows = []  # Initialize rows to empty list in case of exception
        try:
            cursor.execute(query, resume_ids)
            rows = cursor.fetchall() or []  # Ensure rows is never None
            logger.info(f"Database query returned {len(rows)} rows")
        except Exception as db_error:
            logger.error(f"Database query error: {str(db_error)}")
            logger.error(f"Query was: {query} with {len(resume_ids)} parameters")
            return {}
        finally:
            cursor.close()
        conn.close()

        # Process results
        for row in rows:  # This is now safe because rows is always a list
            if not row or len(row) < 10:  # Check row has enough elements
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
        
        # Log which IDs weren't found - make sure resume_ids is iterable
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

def hybrid_search(jd_text, max_results=30, min_experience=0, jd_analysis=None):
    """
    Perform hybrid search combining vector similarity and text search
    
    Args:
        jd_text: Job description text
        max_results: Maximum number of results to return
        min_experience: Minimum experience required
        jd_analysis: Pre-computed job description analysis
    
    Returns:
        List of resume objects with scores matching the job description
    """
    try:
        # Parse JD info to get more structured data - reuse analysis if provided
        jd_info = jd_analysis if jd_analysis else analyze_jd(jd_text)
        
        # Create a more focused query from the job description
        focused_query = create_focused_search_query(jd_text, jd_info)
        
        # Generate embedding for the query
        query_embedding = generate_embedding(focused_query)
        
        # Get OpenSearch client
        client = get_opensearch_client()
        
        # Use the confirmed working index
        working_index = OPENSEARCH_INDEX  # This should be 'resume-embeddings'
        logger.info(f"Using index: {working_index} for hybrid search")
        
        # Extract key terms for better text matching
        key_terms = []
        if jd_info.get("required_skills"):
            key_terms.extend(jd_info["required_skills"])
        if jd_info.get("job_title"):
            key_terms.append(jd_info["job_title"])
        
        # Get more results than needed for filtering
        initial_size = min(max(max_results * 3, 30), 100)
            
        # Build optimized hybrid query combining vector and text search
        search_query = {
            "size": initial_size,
            "query": {
                "bool": {
                    "should": [
                        # Vector search component with higher weight for semantic matching
                        {
                            "knn": {
                                "resume_embedding": {
                                    "vector": query_embedding,
                                    "k": initial_size,
                                    "boost": 3.0  # Higher weight for semantic matching
                                }
                            }
                        },
                        # Text search components for keyword matching
                        {
                            "multi_match": {
                                "query": focused_query,
                                "fields": [
                                    "skills^3",       # Higher weight for skills
                                    "positions^2.5",  # High weight for job titles
                                    "summary^1.5",    # Medium weight for summary
                                    "companies.description^1", 
                                    "projects.description^1",
                                    "education.degree^1"
                                ],
                                "type": "best_fields",
                                "tie_breaker": 0.3,
                                "fuzziness": "AUTO:4,7",
                                "boost": 1.0
                            }
                        }
                    ],
                    "minimum_should_match": 1,
                }
            },
            "_source": ["resume_id", "skills", "total_experience", "positions"]
        }
        
        # Add boost for specific skills if available
        if key_terms and len(key_terms) > 0:
            term_queries = []
            for term in key_terms[:10]:  # Limit to top 10 terms
                if len(term) >= 3:  # Skip very short terms
                    term_queries.append({
                        "match_phrase": {
                            "skills": {
                                "query": term,
                                "boost": 1.5  # Boost for specific skill matches
                            }
                        }
                    })
            
            # Add term queries if we have any valid ones
            if term_queries:
                search_query["query"]["bool"]["should"].extend(term_queries)
        
        # Implement retry mechanism with exponential backoff
        max_retries = 3
        retry_delay = 1  # starting delay in seconds
        
        for attempt in range(max_retries):
            try:
                # Execute search with retry
                logger.info(f"OpenSearch hybrid search attempt {attempt+1}/{max_retries}")
                start_time = time.time()
                
                response = client.search(
                    body=search_query,
                    index=working_index,
                    request_timeout=30  # Extended timeout
                )
                
                elapsed = time.time() - start_time
                logger.info(f"Hybrid search successful, took {elapsed:.2f}s")
                break  # Success, exit retry loop
                
            except Exception as e:
                logger.error(f"Hybrid search attempt {attempt+1} failed: {str(e)}")
                
                if attempt == max_retries - 1:  # Last attempt
                    logger.error(f"All {max_retries} hybrid search attempts failed")
                    
                    # Fall back to regular vector search
                    logger.info("Falling back to regular vector search")
                    return vector_search(jd_text, max_results, min_experience, True, jd_analysis)
                
                # Calculate exponential backoff with jitter
                jitter = random.uniform(0, 0.5)
                wait_time = (2 ** attempt * retry_delay) + jitter
                
                logger.warning(f"Retrying in {wait_time:.2f} seconds...")
                time.sleep(wait_time)
        
        # Process results
        hits = response.get('hits', {}).get('hits', [])
        total_hits = response.get('hits', {}).get('total', {})
        if isinstance(total_hits, dict):
            total_count = total_hits.get('value', 0)
        else:
            total_count = total_hits
            
        logger.info(f"Hybrid search returned {len(hits)} hits out of {total_count} total matches")
        
        if not hits:
            logger.warning("No hybrid search results found, falling back to vector search")
            return vector_search(jd_text, max_results, min_experience, True, jd_analysis)
        
        # Process initial results - similar to vector_search reranking
        initial_results = []
        
        # Find min and max scores for normalization
        scores = [hit.get('_score', 0) for hit in hits]
        max_score = max(scores) if scores else 1.0
        min_score = min(scores) if scores else 0.0
        score_range = max(max_score - min_score, 0.0001)  # Avoid division by zero
        
        for hit in hits:
            doc = hit.get('_source', {})
            
            # Apply experience filter
            resume_exp = float(doc.get('total_experience', 0))
            if min_experience > 0 and resume_exp < min_experience:
                continue  # Skip resumes that don't meet minimum experience
                
            # Normalize score
            raw_score = hit.get('_score', 0)
            normalized_score = ((raw_score - min_score) / score_range) * 100
            
            # Apply sigmoid normalization
            relevance_factor = 12.0  # Adjusted for hybrid search
            normalized_score = 100 * (1 / (1 + math.exp(-((normalized_score/100 - 0.5) * relevance_factor))))
            normalized_score = min(round(normalized_score, 2), 100)
            
            doc['score'] = normalized_score
            doc['raw_score'] = raw_score
            
            initial_results.append(doc)
        
        # Apply reranking with skill match and experience match
        reranked_results = []
        jd_skills = jd_info.get("required_skills", [])
        
        for resume in initial_results:
            # Extract skills
            resume_skills = []
            if 'skills' in resume:
                if isinstance(resume['skills'], list):
                    resume_skills = resume['skills']
                elif isinstance(resume['skills'], str):
                    resume_skills = [resume['skills']]
            
            # Calculate skill match
            skill_score = 0
            if jd_skills and resume_skills:
                skill_score = calculate_skill_match_score(resume_skills, jd_skills)
            
            # Calculate experience match
            exp_score = 0
            if 'total_experience' in resume and jd_info.get('required_experience', 0) > 0:
                resume_exp = float(resume.get('total_experience', 0))
                jd_exp = float(jd_info.get('required_experience', 0))
                exp_score = calculate_experience_match(resume_exp, jd_exp)
            
            # Calculate position match
            position_score = 0
            if jd_info.get('job_title') and 'positions' in resume:
                job_title = jd_info.get('job_title', '').lower()
                resume_positions = resume['positions'] if isinstance(resume['positions'], list) else [resume['positions']]
                
                for position in resume_positions:
                    position_lower = position.lower() if position else ""
                    if job_title == position_lower:
                        position_score = 100
                        break
                    elif position_lower and (job_title in position_lower or position_lower in job_title):
                        position_score = max(position_score, 70)
            
            # Calculate combined rerank score - weights adjusted for hybrid search
            # Since hybrid search already includes text matching
            hybrid_weight = 0.55    # Higher weight for hybrid score
            skill_weight = 0.25     # Slightly reduced from vector search
            position_weight = 0.10  # Same as vector search
            exp_weight = 0.10       # Slightly reduced from vector search
            
            rerank_score = (
                resume['score'] * hybrid_weight +
                skill_score * skill_weight +
                position_score * position_weight +
                exp_score * exp_weight
            )
            
            # Store scores in the result
            resume['rerank_score'] = min(round(rerank_score, 2), 100)
            resume['skill_score'] = skill_score
            resume['exp_score'] = exp_score
            resume['position_score'] = position_score
            
            reranked_results.append(resume)
        
        # Sort by reranked score
        reranked_results.sort(key=lambda x: x['rerank_score'], reverse=True)
        
        # Return full resume info with scores instead of just IDs
        final_results = reranked_results[:max_results]
        
        # Make sure final_results is never None
        if final_results is None:
            logger.error("final_results in vector_search is None, initializing to empty list")
            final_results = []
        
        # Get PII data for all matches
        resume_ids = []
        try:
            resume_ids = [match.get('resume_id') for match in final_results if isinstance(match, dict)]
        except Exception as e:
            logger.error(f"Error extracting resume IDs: {str(e)}")
            
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
            else:
                # Create fallback personal info using position for candidates without PII data
                id_hash = resume_id[:8] if resume_id and len(resume_id) >= 8 else resume_id
                
                # Try to extract job title from positions if available
                position_title = None
                if match.get('positions') and isinstance(match['positions'], list) and len(match['positions']) > 0:
                    position_title = match['positions'][0]
                
                # Create fallback personal info
                match['personal_info'] = {
                    'name': position_title if position_title else f"Candidate {id_hash}",
                    'email': f"candidate-{id_hash.lower()}@example.com" if id_hash else "",
                    'phone_number': f"(555) {id_hash[:3]}-{id_hash[3:6]}" if id_hash and len(id_hash) >= 6 else "",
                    'address': "Address information not available",
                    'linkedin_url': ""
                }
                
                # Create fallback file info if needed
                if not match.get('file_info'):
                    match['file_info'] = {
                        'original_filename': f"resume-{id_hash}.pdf" if id_hash else "resume.pdf",
                        'file_type': 'pdf',
                        's3_bucket': 'tg-ai-rec',  # Default bucket - should be configured as env var
                        's3_key': f"processed/resumes/{resume_id}.pdf" if resume_id else "",
                    }
        
        # NO DEDUPLICATION - Return all results even if there are duplicates
        # Just log the number of results and continue
        
        # Count how many unique resume IDs we have for logging purposes
        unique_resume_ids = set()
        
        # Ensure final_results is not None before iterating
        if final_results is None:
            logger.error("final_results is None, initializing to empty list")
            final_results = []
            
        for match in final_results:
            if not isinstance(match, dict):
                logger.warning(f"Unexpected match type: {type(match)}, skipping")
                continue
                
            resume_id = match.get('resume_id')
            if resume_id:
                unique_resume_ids.add(resume_id)
        
        logger.info(f"Found {len(final_results)} total results with {len(unique_resume_ids)} unique resume IDs")
        # No deduplication - use all results
        deduplicated_results = final_results
        
    except Exception as e:
        logger.error(f"Error in hybrid search: {str(e)}")
        # Fall back to regular vector search
        logger.error(f"Error performing vector search: {str(e)}")
        raise e

    return deduplicated_results

def is_allowed_origin(origin):
    """Check if the origin is allowed for CORS"""
    # Handle cases where origin is None or empty
    if not origin:
        return '*'
        
    # List of allowed origins
    allowed_origins = [
        'http://localhost:3000',              # Local development
        'http://localhost:5173',              # Vite default port
        'http://localhost:8080',              # Another common local dev port
        'https://main.d2stzfqnce7vfm.amplifyapp.com',  # Amplify domain
        'https://airecapp.com',               # Example production domain
        'https://www.airecapp.com'            # Example with www subdomain
    ]
    
    # Check if the origin is in the allowed list
    if origin in allowed_origins:
        return origin
    
    # For development, we'll return the wildcard
    # In production, you should return a specific origin or None
    return '*'

def lambda_handler(event, context):
    """AWS Lambda handler function for resume matching API"""
    # Capture start time for performance tracking
    start_time = time.time()
    
    # Get origin from request headers
    request_headers = event.get('headers', {}) or {}
    origin = request_headers.get('origin') or request_headers.get('Origin')
    
    # Check if origin is allowed
    allowed_origin = is_allowed_origin(origin)
    
    # Define CORS headers
    cors_headers = {
        'Access-Control-Allow-Origin': allowed_origin,
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,cognito-identity-id,x-requested-with',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'  # Cache preflight request for 24 hours
    }
    
    # Handle OPTIONS request (preflight)
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }
    
    try:
        # Log Lambda invocation details - keep minimal
        request_id = context.aws_request_id if context else "unknown"
        logger.info(f"LAMBDA INVOCATION - REQUEST ID: {request_id}")
        
        # Parse input parameters
        if not event:
            logger.warning("Empty event received")
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'message': 'No input provided'
                })
            }
        
        # Log essential event info
        logger.info(f"Event type: {type(event).__name__}")
        
        # GET THE JOB DESCRIPTION - Support both GET (query params) and POST (body)
        jd_text = None
        
        # Check for query string parameters first (GET request)
        if 'queryStringParameters' in event and event['queryStringParameters']:
            if 'job_description' in event['queryStringParameters']:
                jd_text = event['queryStringParameters']['job_description']
                logger.info(f"Extracted job description from query parameters, length: {len(jd_text)}")
        
        # If no job description in query params, check body (POST request)
        if not jd_text and 'body' in event and event['body']:
            try:
                # Try to parse body as JSON
                body = json.loads(event['body'])
                jd_text = body.get('job_description', '')
                logger.info(f"Extracted job description from JSON body, length: {len(jd_text)}")
            except Exception as e:
                # If not valid JSON, use raw body
                logger.error(f"Failed to parse body as JSON: {str(e)}")
                jd_text = event.get('body', '')
                logger.info(f"Using raw body as job description, length: {len(jd_text)}")
        
        # If still no job description, check direct 'job_description' in event (direct Lambda invocation)
        if not jd_text and 'job_description' in event:
            jd_text = event.get('job_description', '')
            logger.info(f"Direct invocation with job description, length: {len(jd_text)}")
        
        # Validate job description
        if not jd_text or not isinstance(jd_text, str):
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'message': 'Job description must be provided as a string'
                })
            }
            
        if len(jd_text.strip()) < 10:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'message': 'Job description is too short (minimum 10 characters)'
                })
            }
            
        # Get and validate optional parameters
        try:
            max_results = int(event.get('max_results', 30))
            if max_results < 1:
                max_results = 1
            elif max_results > 100:
                max_results = 100
        except (TypeError, ValueError):
            max_results = 30
            logger.warning("Invalid max_results parameter, defaulting to 30")
        
        # Parse enable_reranking parameter 
        # (keeping for backward compatibility, but we always use reranking with hybrid search)
        enable_reranking = event.get('enable_reranking', True)
        if isinstance(enable_reranking, str):
            enable_reranking = enable_reranking.lower() == 'true'
        
        # Get minimum experience parameter
        try:
            # Check query string parameters first for GET requests
            if 'queryStringParameters' in event and event['queryStringParameters'] and 'min_experience' in event['queryStringParameters']:
                min_experience = float(event['queryStringParameters']['min_experience'])
            else:
                min_experience = float(event.get('min_experience', 0))
        except (TypeError, ValueError):
            min_experience = 0
        
        # Analyze the JD to extract requirements (uses MODEL_ID via BEDROCK_MODEL_ID)
        jd_analysis = analyze_jd(jd_text)
        required_experience = jd_analysis.get('required_experience', 0)
        required_skills = jd_analysis.get('required_skills', [])
        job_title = jd_analysis.get('job_title', 'Not specified')
        
        # Apply min_experience parameter if it's higher than the extracted value
        if min_experience > required_experience:
            logger.info(f"Using provided min_experience: {min_experience} (overriding extracted value: {required_experience})")
            required_experience = min_experience
        else:
            logger.info(f"Using extracted required_experience: {required_experience}")
        
        # CRITICAL CHECKPOINT - Remove verbose printing
        logger.info(f"Starting hybrid search for '{job_title}' with {len(required_skills)} skills")
        
        # Use hybrid search by default - combines vector similarity and text matching for best results
        try:
            resume_matches = hybrid_search(
                jd_text, 
                max_results=max_results, 
                min_experience=required_experience,
                jd_analysis=jd_analysis
            )
            
            # Ensure resume_matches is never None
            if resume_matches is None:
                logger.error("resume_matches is None, initializing to empty list")
                resume_matches = []

    except Exception as e:
            logger.error(f"Error in search: {str(e)}")
            resume_matches = []  # Initialize to empty list on error
        
        # Extract essential information and build response
        results_with_metrics = []
        for match in resume_matches:
            # Prepare skills analysis
            resume_skills = match.get('skills', [])
            if isinstance(resume_skills, str):
                resume_skills = [resume_skills]
            
            # Normalize all skills for comparison
            normalized_resume_skills = [normalize_skill(skill.lower()) for skill in resume_skills if skill]
            normalized_required_skills = [normalize_skill(skill.lower()) for skill in required_skills if skill]
            
            # Find missing skills (required but not in resume)
            missing_skills = [skill for skill in required_skills 
                             if normalize_skill(skill.lower()) not in normalized_resume_skills]
            
            # Find matching skills (for highlighting)
            matching_skills = [skill for skill in resume_skills 
                             if any(normalize_skill(skill.lower()) == normalize_skill(req_skill.lower()) 
                                   for req_skill in required_skills)]
            
            # Enhance with partial matches (e.g., "Python" matches "Python 3")
            partial_matches = []
            for req_skill in required_skills:
                req_norm = normalize_skill(req_skill.lower())
                # Check if any resume skill contains this required skill
                for res_skill in resume_skills:
                    if res_skill not in matching_skills:  # Skip skills already counted as exact matches
                        res_norm = normalize_skill(res_skill.lower())
                        # Check for substring match in either direction
                        if (req_norm in res_norm or res_norm in req_norm) and len(req_norm) > 2 and len(res_norm) > 2:
                            partial_matches.append({
                                'required': req_skill,
                                'resume': res_skill
                            })
            
            # Calculate skill coverage percentage
            skill_coverage = 0
            if required_skills:
                # Count exact + partial matches with appropriate weighting
                exact_match_count = len(matching_skills)
                partial_match_count = len(partial_matches) * 0.5  # Give partial matches half weight
                skill_coverage = min(100, round((exact_match_count + partial_match_count) / len(required_skills) * 100, 1))
            
            # Create a simplified view with key metrics and enhanced data
            result = {
                'resume_id': match.get('resume_id', 'unknown'),
                'scores': {
                    'overall': match.get('rerank_score', 0),
                    'skill_match': match.get('skill_score', 0),
                    'experience_match': match.get('exp_score', 0),
                    'position_match': match.get('position_score', 0),
                    'semantic_match': match.get('vector_score', 0),
                    'skill_coverage': skill_coverage
                },
                'skills': {
                    'all': resume_skills,
                    'matching': matching_skills,
                    'missing': missing_skills,
                    'partial_matches': partial_matches
                },
                'experience': {
                    'years': match.get('total_experience', 0),
                    'required': required_experience,
                    'difference': round(float(match.get('total_experience', 0)) - required_experience, 1)
                },
                'positions': match.get('positions', []),
                'education': match.get('education', []),
                'companies': match.get('companies', []),
                'projects': match.get('projects', []),
                'certifications': match.get('certifications', []),
                'languages': match.get('languages', []),
                'summary': match.get('summary', '')
            }
            
            # Include PII data if it exists in the match
            if 'personal_info' in match:
                result['personal_info'] = match.get('personal_info')
                
            if 'file_info' in match:
                result['file_info'] = match.get('file_info')
                
            results_with_metrics.append(result)
        
        # Create a summary of most common missing skills across candidates
        skill_gap_analysis = {}
        if results_with_metrics:
            # Count missing skills across all results
            for result in results_with_metrics:
                for skill in result['skills']['missing']:
                    if skill in skill_gap_analysis:
                        skill_gap_analysis[skill] += 1
                    else:
                        skill_gap_analysis[skill] = 1
            
            # Convert to sorted list
            skill_gap_list = [{"skill": k, "missing_count": v, "missing_percent": round((v / len(results_with_metrics)) * 100, 1)} 
                             for k, v in skill_gap_analysis.items()]
            skill_gap_list.sort(key=lambda x: x['missing_count'], reverse=True)
        
        # Add processing metadata including performance information
        end_time = time.time()
        processing_time_ms = round((end_time - start_time) * 1000)
        processing_metadata = {
            "timestamp": datetime.now().isoformat(),
            "processing_time_ms": processing_time_ms,
            "model_id": BEDROCK_MODEL_ID or "template-based-analysis",
            "analyzed_candidates_count": len(results_with_metrics),
            "performance": {
                "total_duration_ms": processing_time_ms,
                "candidates_per_second": round(len(results_with_metrics) / (processing_time_ms/1000), 2) if processing_time_ms > 0 else 0
            }
        }
        
        # Return results with full metrics, enhanced data, and professional analysis
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'message': 'Successfully matched resumes',
                'total_results': len(results_with_metrics),
                'job_info': {
                    'title': job_title,
                    'required_experience': required_experience,
                    'required_skills': required_skills
                },
                'skill_gap_analysis': skill_gap_list,
                'processing_metadata': processing_metadata,
                'results': results_with_metrics
            })
        }
        
    except Exception as e:
        # Include performance data even in error responses
        if 'start_time' in locals():
            processing_time_ms = round((time.time() - start_time) * 1000)
        else:
            processing_time_ms = None
            
        logger.error(f"Error in lambda_handler: {str(e)}")
        # Add more detailed error information based on error type
        error_msg = str(e)
        if "NotFoundError(404" in error_msg:
            error_msg = f"OpenSearch index not found - verify that index '{OPENSEARCH_INDEX}' exists. Check environment variables."
        elif "ConnectionError" in error_msg:
            error_msg = f"Failed to connect to OpenSearch endpoint: {OPENSEARCH_ENDPOINT}. Check network configuration."
        elif "AuthorizationException" in error_msg or "AccessDeniedException" in error_msg:
            error_msg = "Authorization failed. Check IAM permissions for OpenSearch and Bedrock."
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'message': f'An error occurred: {error_msg}'
            })
        } 