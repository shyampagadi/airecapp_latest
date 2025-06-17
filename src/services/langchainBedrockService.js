import { Auth } from 'aws-amplify';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import config from '../config';

/**
 * Simple service to use LangChain with AWS Bedrock
 */
class LangchainBedrockService {
  /**
   * Initialize BedrockChat with AWS credentials
   */
  async getBedrockModel(modelId, parameters = {}) {
    try {
      // Get AWS credentials from Amplify Auth
      const credentials = await Auth.currentCredentials();
      
      // Create BedrockChat instance
      return new BedrockChat({
        model: modelId,
        region: config.region || 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
        modelKwargs: parameters
      });
    } catch (error) {
      console.error('Error initializing Bedrock model:', error);
      throw error;
    }
  }

  /**
   * Analyze candidate profile using AWS Bedrock
   */
  async analyzeCandidate(candidate, jobInfo, options = {}) {
    try {
      // Get model parameters
      const modelId = options.modelId || process.env.REACT_APP_BEDROCK_DEFAULT_MODEL || process.env.REACT_APP_BEDROCK_MODEL_ID || 'meta.llama3-70b-instruct-v1:0';
      const parameters = this._getModelParameters(modelId, options.parameters);
      
      // Initialize Bedrock model
      const model = await this.getBedrockModel(modelId, parameters);
      
      // Create prompt
      const prompt = this._createCandidatePrompt(candidate, jobInfo);
      
      // Invoke model
      console.log('Invoking Bedrock model:', modelId);
      const response = await model.invoke(prompt);
      
      // Process response
      return {
        success: true,
        data: this._processResponse(response.content)
      };
    } catch (error) {
      console.error('Error analyzing candidate:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze candidate'
      };
    }
  }

  /**
   * Process raw LLM response
   * @private
   */
  _processResponse(rawText) {
    // Extract sections from the response
    const sections = this._extractSections(rawText);
    
    return {
      rawText,
      sections
    };
  }
  
  /**
   * Extract sections from raw text
   * @private
   */
  _extractSections(text) {
    return {
      executiveSummary: this._extractSection(text, 'EXECUTIVE SUMMARY', 'SCORE ANALYSIS'),
      scoreAnalysis: this._extractSection(text, 'SCORE ANALYSIS', 'KEY STRENGTHS'),
      keyStrengths: this._extractSection(text, 'KEY STRENGTHS', 'AREAS FOR CONSIDERATION'),
      areasForConsideration: this._extractSection(text, 'AREAS FOR CONSIDERATION', 'INTERVIEW RECOMMENDATIONS'),
      interviewRecommendations: this._extractSection(text, 'INTERVIEW RECOMMENDATIONS', 'FINAL RECOMMENDATION'),
      finalRecommendation: this._extractSection(text, 'FINAL RECOMMENDATION', null)
    };
  }
  
  /**
   * Extract a specific section from text
   * @private
   */
  _extractSection(text, startMarker, endMarker) {
    // Find start position
    const startPos = text.indexOf(startMarker);
    if (startPos === -1) return '';
    
    const startWithMarker = startPos + startMarker.length;
    
    // Find end position
    const endPos = endMarker ? text.indexOf(endMarker, startWithMarker) : text.length;
    if (endPos === -1) return text.substring(startWithMarker).trim();
    
    return text.substring(startWithMarker, endPos).trim();
  }
  
  /**
   * Create a prompt for candidate analysis
   * @private
   */
  _createCandidatePrompt(candidate, jobInfo) {
    const personal_info = candidate.personal_info || {};
    const skills = candidate.skills || {};
    const experience = candidate.experience || {};
    const positions = candidate.positions || [];
    const education = candidate.education || [];
    const scores = candidate.scores || {};
    
    // Format skills
    const matchingSkills = skills.matching?.join(', ') || 'None';
    const missingSkills = skills.missing?.join(', ') || 'None';
    const allSkills = skills.all?.join(', ') || 'None';
    
    // Format education
    const educationInfo = education && Array.isArray(education) 
      ? education.map(edu => `${edu.degree || ''} from ${edu.institution || ''} (${edu.year || 'N/A'})`).join('\n')
      : 'No education information available';
    
    return `
You are an expert AI recruiter assistant analyzing a candidate profile against job requirements.

CANDIDATE INFORMATION:
Name: ${personal_info.name || 'Not provided'}
Current position: ${positions[0] || 'Not provided'}
Total experience: ${experience.years || 'Not provided'} years
Matching skills: ${matchingSkills}
Missing skills: ${missingSkills}
All skills: ${allSkills}
Education: ${educationInfo}

JOB REQUIREMENTS:
Title: ${jobInfo?.job_title || 'Not specified'}
Required skills: ${jobInfo?.required_skills?.join(', ') || 'Not specified'}
Required experience: ${jobInfo?.required_experience || 'Not specified'} years

MATCH SCORES:
Overall match: ${scores.overall || 0}%
Skill match: ${scores.skill_match || scores.skill_coverage || 0}%
Experience match: ${scores.experience_match || 0}%

Please provide a comprehensive professional analysis with the following sections:

1. EXECUTIVE SUMMARY (2-3 sentences overview of the candidate)

2. SCORE ANALYSIS (Explain why the candidate received their match scores)

3. KEY STRENGTHS (3-5 bullet points highlighting the candidate's strongest qualifications)

4. AREAS FOR CONSIDERATION (2-3 potential gaps or concerns)

5. INTERVIEW RECOMMENDATIONS (2-3 specific areas to probe during an interview)

6. FINAL RECOMMENDATION (Overall assessment of candidate fit for the position)

Format your response with clear section headings and professional language suitable for a recruitment context.`;
  }
  
  /**
   * Get model-specific parameters
   * @private
   */
  _getModelParameters(modelId, userParams = {}) {
    const params = {...userParams};
    
    // Set default parameters based on model
    if (modelId.includes('meta.llama')) {
      return {
        max_gen_len: params.max_gen_len || 512,
        temperature: params.temperature || 0.5,
        top_p: params.top_p || 0.9
      };
    } else if (modelId.includes('anthropic.claude')) {
      return {
        max_tokens_to_sample: params.max_tokens_to_sample || 1024,
        temperature: params.temperature || 0.3,
        top_p: params.top_p || 0.9
      };
    } else if (modelId.includes('amazon.titan')) {
      return {
        maxTokenCount: params.maxTokenCount || 800,
        temperature: params.temperature || 0.4,
        topP: params.top_p || 0.9
      };
    }
    
    // Default parameters
    return {
      temperature: params.temperature || 0.5,
      top_p: params.top_p || 0.9
    };
  }
}

export default new LangchainBedrockService(); 