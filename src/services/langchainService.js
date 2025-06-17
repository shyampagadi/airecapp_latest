import { Auth } from 'aws-amplify';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';

/**
 * LangChain service for candidate analysis using AWS Bedrock
 * This implementation runs directly in the browser
 */
class LangchainService {
  /**
   * Initialize the LangChain components
   * @private
   */
  async _initialize(modelId, parameters = {}) {
    try {
      // Get AWS credentials from Amplify Auth
      const credentials = await Auth.currentCredentials();
      
      // Create BedrockChat instance with the credentials
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

      return model;
    } catch (error) {
      console.error('Error initializing LangChain:', error);
      throw new Error(`Failed to initialize LangChain: ${error.message}`);
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
   * Extract sections from the raw text response
   * @private
   */
  _extractSections(rawText) {
    const sections = {
      executiveSummary: this._extractSection(rawText, 'EXECUTIVE SUMMARY', 'SCORE ANALYSIS'),
      scoreAnalysis: this._extractSection(rawText, 'SCORE ANALYSIS', 'KEY STRENGTHS'),
      keyStrengths: this._extractSection(rawText, 'KEY STRENGTHS', 'AREAS FOR CONSIDERATION'),
      areasForConsideration: this._extractSection(rawText, 'AREAS FOR CONSIDERATION', 'INTERVIEW RECOMMENDATIONS'),
      interviewRecommendations: this._extractSection(rawText, 'INTERVIEW RECOMMENDATIONS', 'FINAL RECOMMENDATION'),
      finalRecommendation: this._extractSection(rawText, 'FINAL RECOMMENDATION', null)
    };

    return {
      rawText,
      sections
    };
  }

  /**
   * Extract a section from the raw text
   * @private
   */
  _extractSection(text, startMarker, endMarker) {
    try {
      // Find the start marker
      const startIndex = text.indexOf(startMarker);
      if (startIndex === -1) {
        // Try with different formats like "1." or "• "
        const numberPattern = new RegExp(`\\d+\\.\\s*${startMarker}`);
        const bulletPattern = new RegExp(`•\\s*${startMarker}`);
        
        const numberMatch = numberPattern.exec(text);
        const bulletMatch = bulletPattern.exec(text);
        
        if (numberMatch) {
          const start = numberMatch.index;
          return this._extractAfterMarker(text, start + numberMatch[0].length, endMarker);
        } else if (bulletMatch) {
          const start = bulletMatch.index;
          return this._extractAfterMarker(text, start + bulletMatch[0].length, endMarker);
        } else {
          return "";
        }
      }
      
      return this._extractAfterMarker(text, startIndex + startMarker.length, endMarker);
    } catch (error) {
      console.error(`Error extracting section '${startMarker}':`, error);
      return "";
    }
  }

  /**
   * Helper to extract content after a marker
   * @private
   */
  _extractAfterMarker(text, startOffset, endMarker) {
    if (!endMarker) {
      return text.substring(startOffset).trim();
    }
    
    const endIndex = text.indexOf(endMarker, startOffset);
    if (endIndex === -1) {
      // Try with different formats
      const numberPattern = new RegExp(`\\d+\\.\\s*${endMarker}`);
      const bulletPattern = new RegExp(`•\\s*${endMarker}`);
      
      const afterStartText = text.substring(startOffset);
      const numberMatch = numberPattern.exec(afterStartText);
      const bulletMatch = bulletPattern.exec(afterStartText);
      
      if (numberMatch) {
        return afterStartText.substring(0, numberMatch.index).trim();
      } else if (bulletMatch) {
        return afterStartText.substring(0, bulletMatch.index).trim();
      } else {
        return afterStartText.trim();
      }
    }
    
    return text.substring(startOffset, endIndex).trim();
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
   * Analyze a candidate profile against job requirements using LangChain
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
      console.log('LangchainService: Analyzing candidate profile');
      const startTime = Date.now();
      
      // Default model and parameters if not provided
      const modelId = options.modelId || 'meta.llama3-70b-instruct-v1:0';
      
      // Format parameters based on the model
      let modelParameters = {};
      if (options.parameters) {
        if (modelId.includes('meta.llama')) {
          modelParameters = {
            max_gen_len: options.parameters.max_gen_len || 512,
            temperature: options.parameters.temperature || 0.5,
            top_p: options.parameters.top_p || 0.9
          };
        } else if (modelId.includes('anthropic.claude')) {
          modelParameters = {
            max_tokens_to_sample: options.parameters.max_tokens_to_sample || 1024,
            temperature: options.parameters.temperature || 0.3,
            top_p: options.parameters.top_p || 0.9,
            stop_sequences: ["\n\nHuman:"]
          };
        } else if (modelId.includes('amazon.titan')) {
          modelParameters = {
            maxTokenCount: options.parameters.maxTokenCount || 800,
            temperature: options.parameters.temperature || 0.4,
            topP: options.parameters.top_p || 0.9
          };
        }
      }
      
      // Format candidate data
      const formattedCandidate = this._formatCandidateData(candidate);
      
      // Extract needed data
      const personal_info = formattedCandidate.personal_info || {};
      const skills = formattedCandidate.skills || {};
      const experience = formattedCandidate.experience || {};
      const positions = formattedCandidate.positions || [];
      const education = formattedCandidate.education || [];
      const scores = formattedCandidate.scores || {};
      
      // Format education info
      const educationInfo = education && Array.isArray(education) 
        ? education.map(edu => `${edu.degree || ''} from ${edu.institution || ''} (${edu.year || 'N/A'})`).join('\n')
        : 'No education information available';
      
      // Initialize LangChain components
      const model = await this._initialize(modelId, modelParameters);
      const promptTemplate = this._createPromptTemplate();
      const outputParser = new StringOutputParser();
      
      // Create the chain
      const chain = RunnableSequence.from([
        promptTemplate,
        model,
        outputParser
      ]);
      
      // Prepare the input values for the prompt
      const promptInput = {
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
      
      // Execute the chain
      const bedrockStartTime = Date.now();
      const rawResponse = await chain.invoke(promptInput);
      const bedrockEndTime = Date.now();
      
      // Process the response
      const analysisResult = this._extractSections(rawResponse);
      
      // Calculate processing times
      const endTime = Date.now();
      const totalProcessingTimeMs = endTime - startTime;
      const bedrockProcessingTimeMs = bedrockEndTime - bedrockStartTime;
      
      // Return successful response
      return {
        success: true,
        data: analysisResult,
        metadata: {
          model: modelId,
          parameters: options.parameters || {},
          processing_time_ms: totalProcessingTimeMs,
          bedrock_processing_time_ms: bedrockProcessingTimeMs
        }
      };
    } catch (error) {
      console.error('LangchainService: Error analyzing candidate:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze candidate profile'
      };
    }
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

export default new LangchainService(); 