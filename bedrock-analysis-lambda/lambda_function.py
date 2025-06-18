import json
import os
import boto3
import logging
import time
import re
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Default model if environment variable is not set
DEFAULT_MODEL_ID = 'meta.llama3-70b-instruct-v1:0'

def validate_request(event):
    """Validate the incoming request"""
    # Check if there's a body in the request
    if not event or 'body' not in event:
        return False, "Missing request body"
        
    # Parse the body
    try:
        body = event['body']
        if isinstance(body, str):
            body = json.loads(body)
        
        if not isinstance(body, dict):
            return False, "Request body must be a JSON object"
    except Exception as e:
        return False, f"Invalid JSON in request body: {str(e)}"
    
    # Check required fields
    required_fields = ['candidateData', 'jobInfo']
    for field in required_fields:
        if field not in body:
            return False, f"Missing required field: {field}"
    
    return True, body

def create_candidate_prompt(candidate_data, job_info):
    """Create a prompt for the Bedrock model"""
    if not isinstance(candidate_data, dict):
        candidate_data = {}
    if not isinstance(job_info, dict):
        job_info = {}
        
    personal_info = candidate_data.get('personal_info', {}) if isinstance(candidate_data, dict) else {}
    skills = candidate_data.get('skills', {}) if isinstance(candidate_data, dict) else {}
    experience = candidate_data.get('experience', {}) if isinstance(candidate_data, dict) else {}
    positions = candidate_data.get('positions', []) if isinstance(candidate_data, dict) else []
    education = candidate_data.get('education', []) if isinstance(candidate_data, dict) else []
    scores = candidate_data.get('scores', {}) if isinstance(candidate_data, dict) else {}
    
    # Format skills
    matching_skills = skills.get('matching', []) if isinstance(skills, dict) else []
    missing_skills = skills.get('missing', []) if isinstance(skills, dict) else []
    all_skills = skills.get('all', []) if isinstance(skills, dict) else []
    
    matching_skills_text = ', '.join(matching_skills) if matching_skills else 'None'
    missing_skills_text = ', '.join(missing_skills) if missing_skills else 'None'
    all_skills_text = ', '.join(all_skills) if all_skills else 'None'
    
    # Format education
    education_info = 'No education information available'
    if education and isinstance(education, list):
        education_entries = []
        for edu in education:
            if isinstance(edu, dict):
                degree = edu.get('degree', '') if isinstance(edu, dict) else ''
                institution = edu.get('institution', '') if isinstance(edu, dict) else ''
                year = edu.get('year', 'N/A') if isinstance(edu, dict) else 'N/A'
                education_entries.append(f"{degree} from {institution} ({year})")
            elif isinstance(edu, str):
                education_entries.append(edu)
        
        if education_entries:
            education_info = '\n'.join(education_entries)

    # Get values from job_info safely
    job_title = job_info.get('job_title', 'Not specified') if isinstance(job_info, dict) else 'Not specified'
    required_skills = job_info.get('required_skills', []) if isinstance(job_info, dict) else []
    if not isinstance(required_skills, list):
        required_skills = []
    required_experience = job_info.get('required_experience', 'Not specified') if isinstance(job_info, dict) else 'Not specified'

    # Get values from scores safely
    overall_score = scores.get('overall', 0) if isinstance(scores, dict) else 0
    skill_match = scores.get('skill_match', scores.get('skill_coverage', 0)) if isinstance(scores, dict) else 0
    experience_match = scores.get('experience_match', 0) if isinstance(scores, dict) else 0

    return f"""
You are an expert AI recruiter assistant analyzing a candidate profile against job requirements.

CANDIDATE INFORMATION:
Name: {personal_info.get('name', 'Not provided') if isinstance(personal_info, dict) else 'Not provided'}
Current position: {positions[0] if positions and len(positions) > 0 else 'Not provided'}
Total experience: {experience.get('years', 'Not provided') if isinstance(experience, dict) else 'Not provided'} years
Matching skills: {matching_skills_text}
Missing skills: {missing_skills_text}
All skills: {all_skills_text}
Education: {education_info}

JOB REQUIREMENTS:
Title: {job_title}
Required skills: {', '.join(required_skills) if required_skills else 'Not specified'}
Required experience: {required_experience} years

MATCH SCORES:
Overall match: {overall_score}%
Skill match: {skill_match}%
Experience match: {experience_match}%

Please provide a comprehensive professional analysis with the following sections:

1. EXECUTIVE SUMMARY (2-3 sentences overview of the candidate)

2. SCORE ANALYSIS (Explain why the candidate received their match scores)

3. KEY STRENGTHS (3-5 bullet points highlighting the candidate's strongest qualifications)

4. AREAS FOR CONSIDERATION (2-3 potential gaps or concerns)

5. INTERVIEW RECOMMENDATIONS (2-3 specific areas to probe during an interview)

6. FINAL RECOMMENDATION (Overall assessment of candidate fit for the position)

Format your response with clear section headings and professional language suitable for a recruitment context.
"""

def create_cors_response(status_code, body):
    """Create a standardized API response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def parse_response(raw_text):
    """Parse the raw model response into structured sections"""
    sections = {
        'executiveSummary': extract_section(raw_text, 'EXECUTIVE SUMMARY', 'SCORE ANALYSIS'),
        'scoreAnalysis': extract_section(raw_text, 'SCORE ANALYSIS', 'KEY STRENGTHS'),
        'keyStrengths': extract_section(raw_text, 'KEY STRENGTHS', 'AREAS FOR CONSIDERATION'),
        'areasForConsideration': extract_section(raw_text, 'AREAS FOR CONSIDERATION', 'INTERVIEW RECOMMENDATIONS'),
        'interviewRecommendations': extract_section(raw_text, 'INTERVIEW RECOMMENDATIONS', 'FINAL RECOMMENDATION'),
        'finalRecommendation': extract_section(raw_text, 'FINAL RECOMMENDATION', None)
    }
    
    return {
        'rawText': raw_text,
        'sections': sections
    }

def extract_section(text, start_marker, end_marker):
    """Extract a section from the response text based on markers"""
    try:
        if not text:
            return ""
            
        # Find the start marker
        start_index = text.find(start_marker)
        if start_index == -1:
            # Try with numeric prefix (e.g., "1. EXECUTIVE SUMMARY")
            for i in range(1, 7):  # Try numbers 1-6
                alt_marker = f"{i}. {start_marker}"
                start_index = text.find(alt_marker)
                if start_index != -1:
                    start_marker = alt_marker
                    break
                
                # Also try with just the number and colon
                alt_marker = f"{i}: {start_marker}"
                start_index = text.find(alt_marker)
                if start_index != -1:
                    start_marker = alt_marker
                    break
            
            if start_index == -1:
                return ""
            
        # Get the text after the start marker
        start_offset = start_index + len(start_marker)
        
        # Find the end marker if provided
        if end_marker:
            end_index = text.find(end_marker, start_offset)
            
            # Try with numeric prefix if not found
            if end_index == -1:
                for i in range(1, 7):  # Try numbers 1-6
                    alt_end_marker = f"{i}. {end_marker}"
                    end_index = text.find(alt_end_marker, start_offset)
                    if end_index != -1:
                        break
                    
                    # Also try with just the number and colon
                    alt_end_marker = f"{i}: {end_marker}"
                    end_index = text.find(alt_end_marker, start_offset)
                    if end_index != -1:
                        break
            
            if end_index == -1:
                return text[start_offset:].strip()
            
            return text[start_offset:end_index].strip()
        else:
            # If no end marker, take the rest of the text
            return text[start_offset:].strip()
    except Exception as e:
        logger.error(f"Error extracting section '{start_marker}': {str(e)}")
        return ""

def invoke_bedrock_model(prompt, temperature=0.5, max_gen_len=512, top_p=0.9):
    """Invoke Llama 3 model using boto3"""
    try:
        # Create Bedrock client
        bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=os.environ.get('REACT_APP_AWS_REGION', 'us-east-1')
        )
        
        # Get model ID from environment variable or use default
        model_id = os.environ.get('REACT_APP_BEDROCK_MODEL_ID', DEFAULT_MODEL_ID)
        logger.info(f"Using Bedrock model ID: {model_id}")
        
        # Prepare request body for Llama 3
        body = {
            "prompt": prompt,
            "max_gen_len": max_gen_len,
            "temperature": temperature,
            "top_p": top_p
        }
        
        # Log the request (without sensitive data)
        logger.info(f"Invoking Bedrock model: {model_id}")
        
        # Invoke model
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps(body)
        )
        
        # Parse response
        if response and 'body' in response:
            try:
                response_body = json.loads(response['body'].read().decode('utf-8'))
                return response_body.get('generation', '')
            except Exception as e:
                logger.error(f"Error parsing response body: {str(e)}")
                return ""
        else:
            logger.error("Invalid response format from Bedrock")
            return ""
        
    except Exception as e:
        logger.error(f"Error invoking Bedrock model: {str(e)}")
        raise

def lambda_handler(event, context):
    """AWS Lambda handler function"""
    # Handle OPTIONS request for CORS
    if event and event.get('httpMethod') == 'OPTIONS':
        return create_cors_response(200, {})
    
    start_time = time.time()
    
    try:
        # Log the event for debugging (truncated)
        event_str = "{}" if event is None else json.dumps(event)[:200]
        logger.info(f"Received event: {event_str}")
        
        # Validate the request
        is_valid, result = validate_request(event)
        if not is_valid:
            return create_cors_response(400, {
                'success': False,
                'message': result,
                'data': None
            })
        
        # Extract request data
        body = result  # This should be a dictionary from validate_request
        
        # Safely extract data from body with type checking
        if not isinstance(body, dict):
            return create_cors_response(400, {
                'success': False,
                'message': "Invalid request format",
                'data': None
            })
            
        candidate_data = body.get('candidateData', {})
        job_info = body.get('jobInfo', {})
        
        # Get user-specified parameters or use defaults
        parameters = body.get('parameters', {}) if isinstance(body, dict) else {}
        temperature = parameters.get('temperature', 0.5) if isinstance(parameters, dict) else 0.5
        max_gen_len = parameters.get('max_gen_len', 512) if isinstance(parameters, dict) else 512
        top_p = parameters.get('top_p', 0.9) if isinstance(parameters, dict) else 0.9
        
        # Create prompt for the model
        prompt = create_candidate_prompt(candidate_data, job_info)
        
        # Invoke Bedrock model
        bedrock_start_time = time.time()
        response_text = invoke_bedrock_model(
            prompt=prompt,
            temperature=temperature,
            max_gen_len=max_gen_len,
            top_p=top_p
        )
        bedrock_end_time = time.time()
        
        # Process the response
        analysis_result = parse_response(response_text)
        
        # Calculate processing times
        end_time = time.time()
        total_processing_time_ms = int((end_time - start_time) * 1000)
        bedrock_processing_time_ms = int((bedrock_end_time - bedrock_start_time) * 1000)
        
        # Get the model ID used
        model_id = os.environ.get('REACT_APP_BEDROCK_MODEL_ID', DEFAULT_MODEL_ID)
        
        # Create the response
        response_body = {
            'success': True,
            'message': 'Successfully analyzed candidate profile',
            'data': analysis_result,
            'metadata': {
                'model': model_id,
                'parameters': {
                    'temperature': temperature,
                    'max_gen_len': max_gen_len,
                    'top_p': top_p
                },
                'processing_time_ms': total_processing_time_ms,
                'bedrock_processing_time_ms': bedrock_processing_time_ms
            }
        }
        
        return create_cors_response(200, response_body)
        
    except Exception as e:
        logger.error(f"Error in Lambda handler: {str(e)}")
        return create_cors_response(500, {
            'success': False,
            'message': f"Server error: {str(e)}",
            'data': None
        })