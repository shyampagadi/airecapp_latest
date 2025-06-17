import { Auth } from 'aws-amplify';
import axios from 'axios';

/**
 * Service for AWS Bedrock analysis via API Gateway
 * This avoids browser compatibility issues by using an API Gateway endpoint
 */
class BedrockApiService {
  constructor() {
    // API Gateway endpoint URL (should be set in environment variables)
    this.apiEndpoint = process.env.REACT_APP_API_GATEWAY_URL || 'https://your-api-gateway-url.com';
    this.bedrockPath = process.env.REACT_APP_BEDROCK_API_PATH || '/bedrock';
  }

  /**
   * Invoke a Bedrock model through API Gateway
   *
   * @param {string} modelId - The Bedrock model ID
   * @param {string} prompt - The text prompt to send to the model  
   * @param {Object} parameters - Model-specific parameters
   * @returns {Promise<Object>} The model response
   */
  async invokeModel(modelId, prompt, parameters = {}) {
    try {
      console.log(`BedrockApiService: Invoking model ${modelId}`);
      
      // Get authentication token from the current session
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      // Prepare the request body
      const requestBody = {
        modelId,
        prompt,
        parameters
      };
      
      // Make the API call
      const response = await axios.post(`${this.apiEndpoint}${this.bedrockPath}/invoke`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Check for successful response
      if (response.status !== 200 || !response.data) {
        throw new Error('Invalid response from API');
      }
      
      return {
        success: true,
        content: response.data.text || response.data.generation || response.data.content || '',
        rawResponse: response.data
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
      console.log('BedrockApiService: Analyzing candidate profile');
      const startTime = Date.now();
      
      // Get authentication token from the current session
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      // Default model if not provided
      const modelId = options.modelId || 'meta.llama3-70b-instruct-v1:0';
      const parameters = options.parameters || {};
      
      // Prepare the API request body
      const requestBody = {
        modelId,
        candidate,
        jobInfo,
        parameters
      };
      
      // Make the direct API call to the analysis endpoint
      const bedrockStartTime = Date.now();
      const response = await axios.post(`${this.apiEndpoint}${this.bedrockPath}/analyze`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const bedrockEndTime = Date.now();
      
      if (response.status !== 200 || !response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to analyze candidate profile');
      }
      
      // Calculate processing times
      const endTime = Date.now();
      const totalProcessingTimeMs = endTime - startTime;
      const bedrockProcessingTimeMs = bedrockEndTime - bedrockStartTime;
      
      // Add metadata to the response
      const result = response.data;
      if (result.data) {
        result.data.metadata = {
          ...(result.data.metadata || {}),
          model: modelId,
          parameters: parameters,
          processing_time_ms: totalProcessingTimeMs,
          bedrock_processing_time_ms: bedrockProcessingTimeMs
        };
      }
      
      return result;
    } catch (error) {
      console.error('BedrockApiService: Error analyzing candidate:', error);
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
      temperature: 0.5,
      top_p: 0.9
    };
  }
}

export default new BedrockApiService(); 