import { Auth } from 'aws-amplify';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';

/**
 * Service for analyzing candidate profiles using LangChain with AWS Bedrock
 * This implementation runs directly in the browser without needing a Lambda function
 */
class CandidateAnalysisService {
  /**
   * Analyze a candidate profile against job requirements
   * 
   * @param {Object} candidate - The candidate profile data
   * @param {Object} jobInfo - The job requirements data
   * @param {Object} options - Optional parameters
   * @param {String} options.modelId - Bedrock model ID to use (optional)
   * @param {Object} options.parameters - Model parameters (optional)
   * @returns {Promise<Object>} Analysis results or error
   */
  async analyzeCandidate(candidate, jobInfo, options = {}) {
    try {
      console.log('CandidateAnalysisService: Analyzing candidate profile');
      const startTime = Date.now();
      
      // Get AWS credentials from Amplify Auth
      const credentials = await Auth.currentCredentials();
      
      // Default model and parameters if not provided
      const modelId = options.modelId || 'meta.llama3-70b-instruct-v1:0';
      
      // Format parameters based on the model
      const parameters = this._getModelParameters(modelId, options.parameters || {});
      
      // Format candidate data with required structure
      const candidateData = this._formatCandidateData(candidate);
      
      // Create BedrockChat model
      const model = new BedrockChat({
        model: modelId,
        region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
        modelKwargs: parameters
      });
      
      // Create prompt template
      const promptTemplate = this._createPromptTemplate();
      
      // Create output parser
      const outputParser = new StringOutputParser();
      
      // Create the chain
      const chain = RunnableSequence.from([
        promptTemplate,
        model,
        outputParser
      ]);
      
      // Prepare input values for the prompt
      const promptInput = this._createPromptInput(candidateData, jobInfo);
      
      // Execute the chain
      const bedrockStartTime = Date.now();
      const responseText = await chain.invoke(promptInput);
      const bedrockEndTime = Date.now();
      
      // Process the response
      const sections = this._extractSections(responseText);
      
      // Calculate processing times
      const endTime = Date.now();
      const totalProcessingTimeMs = endTime - startTime;
      const bedrockProcessingTimeMs = bedrockEndTime - bedrockStartTime;
      
      // Return structured result
      return {
        success: true,
        data: {
          rawText: responseText,
          sections: sections,
          metadata: {
            model: modelId,
            parameters: parameters,
            processing_time_ms: totalProcessingTimeMs,
            bedrock_processing_time_ms: bedrockProcessingTimeMs
          }
        }
      };
    } catch (error) {
      console.error('CandidateAnalysisService: Error analyzing candidate:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze candidate profile'
      };
    }
  }
  
  /**
   * Create the analysis prompt template
   * @private
   */
  _createPromptTemplate() {
    const template = `
You are an expert AI recruiter assistant analyzing a candidate profile against job requirements.

CANDIDATE INFORMATION:
Name: {name}
Current position: {currentPosition}
Total experience: {yearsExperience} years
Matching skills: {matchingSkills}
Missing skills: {missingSkills}
All skills: {allSkills}
Education: {education}

JOB REQUIREMENTS:
Title: {jobTitle}
Required skills: {requiredSkills}
Required experience: {requiredExperience} years

MATCH SCORES:
Overall match: {overallScore}%
Skill match: {skillScore}%
Experience match: {experienceScore}%

Please provide a comprehensive professional analysis with the following sections:

1. EXECUTIVE SUMMARY (2-3 sentences overview of the candidate)

2. SCORE ANALYSIS (Explain why the candidate received their match scores)

3. KEY STRENGTHS (3-5 bullet points highlighting the candidate's strongest qualifications)

4. AREAS FOR CONSIDERATION (2-3 potential gaps or concerns)

5. INTERVIEW RECOMMENDATIONS (2-3 specific areas to probe during an interview)

6. FINAL RECOMMENDATION (Overall assessment of candidate fit for the position)

Format your response with clear section headings and professional language suitable for a recruitment context.
`;
    
    return PromptTemplate.fromTemplate(template);
  }
  
  /**
   * Create prompt input from candidate and job data
   * @private
   */
  _createPromptInput(candidate, jobInfo) {
    const personal_info = candidate.personal_info || {};
    const skills = candidate.skills || {};
    const experience = candidate.experience || {};
    const positions = candidate.positions || [];
    const education = candidate.education || [];
    const scores = candidate.scores || {};
    
    // Format education info
    const educationInfo = education && Array.isArray(education) 
      ? education.map(edu => `${edu.degree || ''} from ${edu.institution || ''} (${edu.year || 'N/A'})`).join('\n')
      : 'No education information available';
    
    return {
      name: personal_info?.name || 'Not provided',
      currentPosition: positions && positions.length > 0 ? positions[0] : 'Not provided',
      yearsExperience: experience?.years || 'Not provided',
      matchingSkills: skills?.matching?.join(', ') || 'None',
      missingSkills: skills?.missing?.join(', ') || 'None',
      allSkills: skills?.all?.join(', ') || 'None',
      education: educationInfo,
      jobTitle: jobInfo?.job_title || 'Not specified',
      requiredSkills: jobInfo?.required_skills?.join(', ') || 'Not specified',
      requiredExperience: jobInfo?.required_experience || 'Not specified',
      overallScore: scores?.overall || 0,
      skillScore: scores?.skill_match || scores?.skill_coverage || 0,
      experienceScore: scores?.experience_match || 0
    };
  }
  
  /**
   * Extract sections from raw text response
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
   * Format candidate data for the prompt
   * @private
   */
  _formatCandidateData(candidate) {
    // Start with the candidate object (could be partial)
    const formattedData = { ...candidate };
    
    // Ensure required structures exist
    formattedData.personal_info = formattedData.personal_info || {};
    formattedData.skills = formattedData.skills || {};
    formattedData.experience = formattedData.experience || {};
    formattedData.scores = formattedData.scores || {};
    
    // Ensure skills arrays exist
    formattedData.skills.matching = formattedData.skills.matching || [];
    formattedData.skills.missing = formattedData.skills.missing || [];
    formattedData.skills.all = formattedData.skills.all || [];
    
    // Ensure positions is an array
    if (!formattedData.positions || !Array.isArray(formattedData.positions)) {
      formattedData.positions = formattedData.positions ? [formattedData.positions] : [];
    }
    
    // Ensure education is an array of objects with required properties
    if (!formattedData.education || !Array.isArray(formattedData.education)) {
      formattedData.education = formattedData.education ? [formattedData.education] : [];
    }
    
    return formattedData;
  }
  
  /**
   * Get model-specific parameters
   * @private
   */
  _getModelParameters(modelId, userParams = {}) {
    // Copy user parameters
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
        top_p: params.top_p || 0.9,
        stop_sequences: ["\n\nHuman:"]
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
  
  /**
   * Get supported Bedrock models for candidate analysis
   * 
   * @returns {Array} List of supported models with their details
   */
  getSupportedModels() {
    return [
      {
        id: 'meta.llama3-70b-instruct-v1:0',
        name: 'Llama 3 (70B)',
        provider: 'Meta',
        description: 'Best overall quality with detailed analysis',
        parameterFormat: 'llama',
        defaultParameters: {
          max_gen_len: 512,
          temperature: 0.5,
          top_p: 0.9
        }
      },
      {
        id: 'meta.llama3-8b-instruct-v1:0',
        name: 'Llama 3 (8B)',
        provider: 'Meta',
        description: 'Faster analysis with good quality',
        parameterFormat: 'llama',
        defaultParameters: {
          max_gen_len: 512,
          temperature: 0.5,
          top_p: 0.9
        }
      },
      {
        id: 'anthropic.claude-3-sonnet-20240229-v1:0',
        name: 'Claude 3 Sonnet',
        provider: 'Anthropic',
        description: 'High quality analysis with nuanced insights',
        parameterFormat: 'claude',
        defaultParameters: {
          max_tokens_to_sample: 1024,
          temperature: 0.3,
          top_p: 0.9
        }
      },
      {
        id: 'amazon.titan-text-express-v1:0',
        name: 'Titan Text Express',
        provider: 'Amazon',
        description: 'Amazon\'s model for efficient analysis',
        parameterFormat: 'titan',
        defaultParameters: {
          maxTokenCount: 800,
          temperature: 0.4,
          topP: 0.9
        }
      }
    ];
  }
  
  /**
   * Get default parameters for a specific model
   * 
   * @param {String} modelId - The Bedrock model ID
   * @returns {Object} Default parameters for the model
   */
  getDefaultParametersForModel(modelId) {
    const model = this.getSupportedModels().find(m => m.id === modelId);
    return model?.defaultParameters || {
      max_gen_len: 512,
      temperature: 0.5,
      top_p: 0.9
    };
  }
}

export default new CandidateAnalysisService(); 