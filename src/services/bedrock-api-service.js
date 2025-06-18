import { Auth } from 'aws-amplify';
import axios from 'axios';
import { API_GATEWAY } from '../config/appConfig';

/**
 * Service for AWS Bedrock analysis via API Gateway
 * This avoids browser compatibility issues by using an API Gateway endpoint
 */
class BedrockApiService {
  constructor() {
    // Use environment variables or appConfig for API configuration
    this.apiEndpoint = API_GATEWAY.bedrockAnalysisEndpoint || process.env.REACT_APP_BEDROCK_ANALYSIS_ENDPOINT || 'http://localhost:3001/analyze';
    this.bedrockPath = process.env.REACT_APP_BEDROCK_API_PATH || '/api/bedrock';
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
      
      // For development, skip authentication
      // In production, you should use proper authentication
      let headers = {
        'Content-Type': 'application/json'
      };
      
      try {
        // Try to get authentication token if available
        const session = await Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (authError) {
        console.warn('Using unauthenticated mode for development');
        // Continue without authentication for development
      }
      
      // Prepare the request body
      const requestBody = {
        modelId,
        prompt,
        parameters
      };
      
      // Make the API call
      const response = await axios.post(`${this.apiEndpoint}${this.bedrockPath}/invoke`, requestBody, {
        headers: headers
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
      
      // Use environment variable for model ID
      const modelId = options.modelId || process.env.REACT_APP_BEDROCK_MODEL_ID || 'meta.llama3-70b-instruct-v1:0';
      const parameters = options.parameters || {};
      
      // Prepare the API request body
      const requestBody = {
        candidateData: candidate,
        jobInfo: jobInfo,
        parameters
      };
      
      // Make the API call to the Lambda function through API Gateway
      console.log(`Calling API endpoint: ${this.apiEndpoint}`);
      console.log('Request payload:', JSON.stringify(requestBody, null, 2));
      
      // Make the direct API call to the analysis endpoint
      const bedrockStartTime = Date.now();
      const response = await axios.post(this.apiEndpoint, requestBody, {
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
    // Default model from environment variable should be first in the list
    const defaultModelId = process.env.REACT_APP_BEDROCK_MODEL_ID || 'meta.llama3-70b-instruct-v1:0';
    
    return [
      {
        id: defaultModelId,
        name: this._getModelDisplayName(defaultModelId),
        provider: this._getModelProvider(defaultModelId),
        description: 'Default model from environment configuration',
        parameterFormat: this._getModelParameterFormat(defaultModelId),
        defaultParameters: this._getDefaultParametersForModelId(defaultModelId)
      },
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
   * Helper method to get model display name
   * @private
   */
  _getModelDisplayName(modelId) {
    if (modelId.includes('llama3-70b')) return 'Llama 3 (70B)';
    if (modelId.includes('llama3-8b')) return 'Llama 3 (8B)';
    if (modelId.includes('claude-3-sonnet')) return 'Claude 3 Sonnet';
    if (modelId.includes('titan-text-express')) return 'Titan Text Express';
    return modelId.split('/').pop();
  }
  
  /**
   * Helper method to get model provider
   * @private
   */
  _getModelProvider(modelId) {
    if (modelId.includes('meta')) return 'Meta';
    if (modelId.includes('anthropic')) return 'Anthropic';
    if (modelId.includes('amazon') || modelId.includes('titan')) return 'Amazon';
    return 'Unknown';
  }
  
  /**
   * Helper method to get model parameter format
   * @private
   */
  _getModelParameterFormat(modelId) {
    if (modelId.includes('llama')) return 'llama';
    if (modelId.includes('claude')) return 'claude';
    if (modelId.includes('titan')) return 'titan';
    return 'default';
  }
  
  /**
   * Helper method to get default parameters for model ID
   * @private
   */
  _getDefaultParametersForModelId(modelId) {
    if (modelId.includes('llama')) {
      return {
        max_gen_len: 512,
        temperature: 0.5,
        top_p: 0.9
      };
    }
    
    if (modelId.includes('claude')) {
      return {
        max_tokens_to_sample: 1024,
        temperature: 0.3,
        top_p: 0.9
      };
    }
    
    if (modelId.includes('titan')) {
      return {
        maxTokenCount: 800,
        temperature: 0.4,
        topP: 0.9
      };
    }
    
    return {
      temperature: 0.5,
      top_p: 0.9
    };
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

const bedrockApiService = new BedrockApiService();
export default bedrockApiService; 