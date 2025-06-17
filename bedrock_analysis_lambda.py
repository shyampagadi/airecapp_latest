import json
import os
import boto3
import logging
from typing import Dict, Any, List
import time
import re

# LangChain imports
from langchain_aws import BedrockLLM
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser
from langchain_core.pydantic_v1 import BaseModel, Field
from typing import Optional, List, Dict

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Define structured output model
class CandidateAnalysis(BaseModel):
    executive_summary: str = Field(description="2-3 sentences overview of the candidate")
    score_analysis: str = Field(description="Explanation of why the candidate received their match scores")
    key_strengths: str = Field(description="3-5 bullet points highlighting the candidate's strongest qualifications")
    areas_for_consideration: str = Field(description="2-3 potential gaps or concerns")
    interview_recommendations: str = Field(description="2-3 specific areas to probe during an interview")
    final_recommendation: str = Field(description="Overall assessment of candidate fit for the position")

def validate_request(event):
    """Validate the incoming request"""
    # Check if there's a body in the request
    if 'body' not in event:
        return False, "Missing request body"
        
    # Parse the body
    try:
        if isinstance(event['body'], str):
            body = json.loads(event['body'])
        else:
            body = event['body']
    except Exception as e:
        return False, f"Invalid JSON in request body: {str(e)}"
    
    # Check required fields
    required_fields = ['candidateData', 'jobInfo']
    for field in required_fields:
        if field not in body:
            return False, f"Missing required field: {field}"
    
    return True, body

def create_analysis_prompt_template():
    """Create a structured prompt template for the LangChain"""
    template = """
You are an expert AI recruiter assistant analyzing a candidate profile against job requirements.

CANDIDATE INFORMATION:
Name: {name}
Current position: {current_position}
Total experience: {years_experience} years
Matching skills: {matching_skills}
Missing skills: {missing_skills}
All skills: {all_skills}
Education: {education}

JOB REQUIREMENTS:
Title: {job_title}
Required skills: {required_skills}
Required experience: {required_experience} years

MATCH SCORES:
Overall match: {overall_score}%
Skill match: {skill_score}%
Experience match: {experience_score}%

Please provide a comprehensive professional analysis with the following sections:

1. EXECUTIVE SUMMARY (2-3 sentences overview of the candidate)

2. SCORE ANALYSIS (Explain why the candidate received their match scores)

3. KEY STRENGTHS (3-5 bullet points highlighting the candidate's strongest qualifications)

4. AREAS FOR CONSIDERATION (2-3 potential gaps or concerns)

5. INTERVIEW RECOMMENDATIONS (2-3 specific areas to probe during an interview)

6. FINAL RECOMMENDATION (Overall assessment of candidate fit for the position)

Format your response with clear section headings and professional language suitable for a recruitment context.
"""
    return PromptTemplate.from_template(template)

def create_cors_response(status_code, body):
    """Create a standardized API response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',  # Adjust as needed for security
            'Access-Control-Allow-Credentials': True,
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def parse_langchain_response(raw_text):
    """Parse the raw LangChain response into structured sections"""
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
        # Find the start marker
        start_index = text.find(start_marker)
        if start_index == -1:
            # Try with different formats like "1." or "• "
            number_pattern = fr"\d+\.\s*{start_marker}"
            bullet_pattern = fr"•\s*{start_marker}"
            
            number_match = re.search(number_pattern, text)
            bullet_match = re.search(bullet_pattern, text)
            
            if number_match:
                start_index = number_match.start()
            elif bullet_match:
                start_index = bullet_match.start()
            else:
                return ""
        
        # Get the text after the start marker
        start_offset = start_index + len(start_marker)
        
        # Find the end marker if provided
        if end_marker:
            end_index = text.find(end_marker, start_offset)
            if end_index == -1:
                # Try with different formats
                number_pattern = fr"\d+\.\s*{end_marker}"
                bullet_pattern = fr"•\s*{end_marker}"
                
                number_match = re.search(number_pattern, text[start_offset:])
                bullet_match = re.search(bullet_pattern, text[start_offset:])
                
                if number_match:
                    end_index = start_offset + number_match.start()
                elif bullet_match:
                    end_index = start_offset + bullet_match.start()
                else:
                    # If end marker not found, take the rest of the text
                    content = text[start_offset:].strip()
                    return content
            
            content = text[start_offset:end_index].strip()
        else:
            # If no end marker, take the rest of the text
            content = text[start_offset:].strip()
        
        return content
    except Exception as e:
        logger.error(f"Error extracting section '{start_marker}': {str(e)}")
        return ""

def lambda_handler(event, context):
    """AWS Lambda handler function"""
    start_time = time.time()
    
    try:
        # Validate the request
        is_valid, result = validate_request(event)
        if not is_valid:
            return create_cors_response(400, {
                'success': False,
                'message': result,
                'data': None
            })
        
        # Extract request data
        body = result
        candidate_data = body.get('candidateData', {})
        job_info = body.get('jobInfo', {})
        model_id = body.get('modelId', os.environ.get('DEFAULT_MODEL_ID', 'meta.llama3-70b-instruct-v1:0'))
        model_parameters = body.get('parameters', {})
        
        # Extract candidate information
        personal_info = candidate_data.get('personal_info', {})
        skills = candidate_data.get('skills', {})
        experience = candidate_data.get('experience', {})
        positions = candidate_data.get('positions', [])
        education = candidate_data.get('education', [])
        scores = candidate_data.get('scores', {})
        
        # Format the candidate's skills
        matching_skills = skills.get('matching', [])
        missing_skills = skills.get('missing', [])
        all_skills = skills.get('all', [])
        
        matching_skills_text = ', '.join(matching_skills) if matching_skills else 'None'
        missing_skills_text = ', '.join(missing_skills) if missing_skills else 'None'
        all_skills_text = ', '.join(all_skills) if all_skills else 'None'
        
        # Format the candidate's education
        education_info = 'No education information available'
        if education and isinstance(education, list):
            education_entries = []
            for edu in education:
                if isinstance(edu, dict):
                    degree = edu.get('degree', '')
                    institution = edu.get('institution', '')
                    year = edu.get('year', 'N/A')
                    education_entries.append(f"{degree} from {institution} ({year})")
                elif isinstance(edu, str):
                    education_entries.append(edu)
            
            if education_entries:
                education_info = '\n'.join(education_entries)
        
        # Create LangChain components
        prompt_template = create_analysis_prompt_template()
        
        # Initialize the BedrockLLM with the selected model and parameters
        llm_params = {}
        
        # Configure model-specific parameters
        if 'meta.llama' in model_id:
            llm_params = {
                'max_gen_len': model_parameters.get('max_gen_len', 512),
                'temperature': model_parameters.get('temperature', 0.5),
                'top_p': model_parameters.get('top_p', 0.9)
            }
        elif 'anthropic.claude' in model_id:
            llm_params = {
                'max_tokens_to_sample': model_parameters.get('max_tokens_to_sample', 1024),
                'temperature': model_parameters.get('temperature', 0.3),
                'top_p': model_parameters.get('top_p', 0.9)
            }
        elif 'amazon.titan' in model_id:
            llm_params = {
                'maxTokenCount': model_parameters.get('maxTokenCount', 800),
                'temperature': model_parameters.get('temperature', 0.4),
                'topP': model_parameters.get('top_p', 0.9)
            }
        
        # Create Bedrock LLM object
        bedrock_llm = BedrockLLM(
            model_id=model_id,
            region_name=os.environ.get('AWS_REGION', 'us-east-1'),
            model_kwargs=llm_params
        )
        
        # Create the LangChain
        chain = prompt_template | bedrock_llm | StrOutputParser()
        
        # Execute the chain with input values
        chain_input = {
            'name': personal_info.get('name', 'Not provided'),
            'current_position': positions[0] if positions and len(positions) > 0 else 'Not provided',
            'years_experience': experience.get('years', 'Not provided'),
            'matching_skills': matching_skills_text,
            'missing_skills': missing_skills_text,
            'all_skills': all_skills_text,
            'education': education_info,
            'job_title': job_info.get('job_title', 'Not specified'),
            'required_skills': ', '.join(job_info.get('required_skills', [])) if job_info.get('required_skills') else 'Not specified',
            'required_experience': job_info.get('required_experience', 'Not specified'),
            'overall_score': scores.get('overall', 0),
            'skill_score': scores.get('skill_match', scores.get('skill_coverage', 0)),
            'experience_score': scores.get('experience_match', 0)
        }
        
        bedrock_start_time = time.time()
        response_text = chain.invoke(chain_input)
        bedrock_end_time = time.time()
        
        # Process the response
        analysis_result = parse_langchain_response(response_text)
        
        # Calculate processing times
        end_time = time.time()
        total_processing_time_ms = int((end_time - start_time) * 1000)
        bedrock_processing_time_ms = int((bedrock_end_time - bedrock_start_time) * 1000)
        
        # Create the response
        response_body = {
            'success': True,
            'message': 'Successfully analyzed candidate profile',
            'data': analysis_result,
            'metadata': {
                'model': model_id,
                'parameters': model_parameters,
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