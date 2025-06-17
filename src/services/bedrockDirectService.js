import { Auth } from 'aws-amplify';

/**
 * Service for direct interaction with AWS Bedrock models via fetch API
 * This implementation avoids Node.js dependencies by not using the AWS SDK
 */
class BedrockDirectService {
  constructor() {
    this.region = process.env.REACT_APP_AWS_REGION || 'us-east-1';
    this.endpoint = `https://bedrock-runtime.${this.region}.amazonaws.com`;
  }

  /**
   * Get AWS SigV4 signed headers for Bedrock API
   * Using Amplify Auth which handles SigV4 for us
   * @private
   */
  async _getSignedHeaders(path, body) {
    try {
      // Get the current authenticated session from Amplify
      const credentials = await Auth.currentCredentials();
      const session = await Auth.currentSession();
      
      // We'll use the Amplify Auth built-in signing functionality
      // Note: This assumes Amplify has been configured with appropriate IAM permissions for Bedrock
      const token = session.getIdToken().getJwtToken();
      
      // Standard headers for the Bedrock API
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      return headers;
    } catch (error) {
      console.error('Error getting signed headers:', error);
      throw error;
    }
  }

  /**
   * Invoke a Bedrock model with a prompt using fetch
   * 
   * @param {string} modelId - The Bedrock model ID
   * @param {string} prompt - The text prompt to send to the model
   * @param {Object} parameters - Model-specific parameters
   * @returns {Promise<Object>} The model response
   */
  async invokeModel(modelId, prompt, parameters = {}) {
    try {
      console.log(`BedrockDirectService: Invoking model ${modelId}`);
      
      // Prepare model parameters based on the model type
      const requestBody = this._getModelRequestBody(modelId, prompt, parameters);
      
      // Path for the API call
      const path = `/model/${modelId}/invoke`;
      const url = `${this.endpoint}${path}`;
      
      // Get signed headers for AWS API authentication
      const headers = await this._getSignedHeaders(path, requestBody);
      
      // Make the API call using fetch
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
      }
      
      // Parse the response
      const responseData = await response.json();
      
      // Extract the generated text based on the model
      const generatedText = this._extractGeneratedText(modelId, responseData);
      
      return {
        success: true,
        content: generatedText,
        rawResponse: responseData
      };
    } catch (error) {
      console.error('Error invoking Bedrock model:', error);
      return {
        success: false,
        error: error.message || 'Failed to invoke model',
      };
    }
  }
  
  /**
   * Extract generated text from model response
   * @private
   */
  _extractGeneratedText(modelId, responseBody) {
    if (modelId.includes('meta.llama')) {
      return responseBody.generation || '';
    } else if (modelId.includes('anthropic.claude')) {
      return responseBody.completion || responseBody.content?.[0]?.text || '';
    } else if (modelId.includes('amazon.titan')) {
      return responseBody.outputText || responseBody.results?.[0]?.outputText || '';
    } else {
      console.warn(`Unknown model format for ${modelId}, attempting to extract text`);
      return responseBody.generation || 
             responseBody.completion || 
             responseBody.outputText || 
             responseBody.results?.[0]?.outputText || 
             responseBody.content?.[0]?.text || 
             JSON.stringify(responseBody);
    }
  }
  
  /**
   * Create the request body based on model type
   * @private
   */
  _getModelRequestBody(modelId, prompt, parameters = {}) {
    // Prepare request body based on the model type
    if (modelId.includes('meta.llama')) {
      return {
        prompt: prompt,
        max_gen_len: parameters.max_gen_len || 512,
        temperature: parameters.temperature || 0.5,
        top_p: parameters.top_p || 0.9
      };
    } else if (modelId.includes('anthropic.claude')) {
      // For Claude 3 models
      if (modelId.includes('claude-3')) {
        return {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: parameters.max_tokens_to_sample || 1024,
          temperature: parameters.temperature || 0.5,
          top_p: parameters.top_p || 0.9,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        };
      } else {
        // For older Claude models
        return {
          prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
          max_tokens_to_sample: parameters.max_tokens_to_sample || 1024,
          temperature: parameters.temperature || 0.5,
          top_p: parameters.top_p || 0.9,
          stop_sequences: ["\n\nHuman:"]
        };
      }
    } else if (modelId.includes('amazon.titan')) {
      return {
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: parameters.maxTokenCount || 800,
          temperature: parameters.temperature || 0.5,
          topP: parameters.top_p || 0.9
        }
      };
    } else {
      console.warn(`Unknown model type: ${modelId}, using default parameters`);
      return {
        prompt: prompt,
        temperature: parameters.temperature || 0.5,
        top_p: parameters.top_p || 0.9
      };
    }
  }
  
  /**
   * Analyze a candidate profile against job requirements
   * 
   * @param {Object} candidate - The candidate profile data
   * @param {Object} jobInfo - The job requirements data
   * @param {Object} options - Optional parameters
   * @param {String} options.modelId - Bedrock model ID to use
   * @param {Object} options.parameters - Model parameters
   * @returns {Promise<Object>} Analysis results or error
   */
  async analyzeCandidate(candidate, jobInfo, options = {}) {
    try {
      console.log('BedrockDirectService: Analyzing candidate profile');
      const startTime = Date.now();
      
      // Default model if not provided
      const modelId = options.modelId || 'meta.llama3-70b-instruct-v1:0';
      const parameters = options.parameters || {};
      
      // Format candidate data with required structure
      const candidateData = this._formatCandidateData(candidate);
      
      // Create prompt for the model
      const prompt = this._createCandidatePrompt(candidateData, jobInfo);
      
      // Invoke the model
      const bedrockStartTime = Date.now();
      const response = await this.invokeModel(modelId, prompt, parameters);
      const bedrockEndTime = Date.now();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to invoke Bedrock model');
      }
      
      // Process the response
      const sections = this._extractSections(response.content);
      
      // Calculate processing times
      const endTime = Date.now();
      const totalProcessingTimeMs = endTime - startTime;
      const bedrockProcessingTimeMs = bedrockEndTime - bedrockStartTime;
      
      // Return structured result
      return {
        success: true,
        data: {
          rawText: response.content,
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
      console.error('BedrockDirectService: Error analyzing candidate:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze candidate profile'
      };
    }
  }
  
  /**
   * Create prompt for candidate analysis
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
    
    // Format education info
    const educationInfo = education && Array.isArray(education) 
      ? education.map(edu => `${edu.degree || ''} from ${edu.institution || ''} (${edu.year || 'N/A'})`).join('\n')
      : 'No education information available';
    
    return `
You are an expert AI recruiter assistant analyzing a candidate profile against job requirements.

CANDIDATE INFORMATION:
Name: ${personal_info.name || 'Not provided'}
Current position: ${positions && positions.length > 0 ? positions[0] : 'Not provided'}
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

Format your response with clear section headings and professional language suitable for a recruitment context.
`;
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
      temperature: 0.5,
      top_p: 0.9
    };
  }
}

export default new BedrockDirectService(); 