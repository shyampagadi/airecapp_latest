/* eslint-disable import/no-anonymous-default-export */
import { Auth, API } from 'aws-amplify';
import axios from 'axios';
import config from '../config';
import { API_GATEWAY } from '../config/appConfig';

/**
 * Service for AWS Bedrock analysis via API Gateway Lambda
 * This handles the candidate analysis through the Bedrock Lambda function
 */
class BedrockApiService {
  constructor() {
    // API Gateway endpoint URL (should be set in environment variables)
    this.apiEndpoint = API_GATEWAY.bedrockAnalysisEndpoint || process.env.REACT_APP_BEDROCK_ANALYSIS_ENDPOINT || '';
    this.analysisPath = ''; // Path is now included in the endpoint
  }

  /**
   * Analyze a candidate profile against job requirements using Lambda function
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
      console.log('BedrockApiService: Analyzing candidate via API Gateway');
      console.log('BedrockApiService: API Endpoint:', this.apiEndpoint);
      
      // Add validation for the API endpoint
      if (!this.apiEndpoint || this.apiEndpoint.trim() === '') {
        console.error('BedrockApiService: API endpoint is not configured');
        return {
          success: false,
          message: 'API endpoint not configured. Check your environment variables.'
        };
      }
      
      // Validate input data
      if (!candidate) {
        console.error('BedrockApiService: Missing candidate data');
        return {
          success: false,
          message: 'Missing candidate data'
        };
      }

      if (!jobInfo) {
        console.error('BedrockApiService: Missing job info data');
        return {
          success: false,
          message: 'Missing job information'
        };
      }
      
      // eslint-disable-next-line no-unused-vars
      const startTime = Date.now();
      
      // Default model if not provided
      const modelId = options.modelId || config.bedrock.defaultModelId || 'meta.llama3-70b-instruct-v1:0';
      const parameters = options.parameters || this.getDefaultParametersForModel(modelId);
      
      // Prepare the API request body - IMPORTANT: wrap in 'body' object to match API Gateway expectations
      const requestBody = {
        body: {
          candidateData: candidate,
          jobInfo: jobInfo,
          modelId: modelId,
          parameters: parameters
        }
      };
      
      console.log(`Calling API endpoint: ${this.apiEndpoint}`);
      console.log('Request payload:', JSON.stringify(requestBody, null, 2));
      
      try {
        // First try using Amplify API module (preferred method)
        console.log('BedrockApiService: Trying API Gateway call via Amplify');
        
        // Check if Auth is available and user is authenticated
        let authStatus = 'Unknown';
        try {
          const session = await Auth.currentSession();
          authStatus = session ? 'Authenticated' : 'Not authenticated';
        } catch (authError) {
          authStatus = `Auth error: ${authError.message}`;
        }
        console.log('BedrockApiService: Auth status:', authStatus);
        
        const response = await API.post('bedrockAnalysisApi', '', {
          body: requestBody,
          headers: {
            'Content-Type': 'application/json'
            // Auth header is automatically added by Amplify
          }
        });
        
        console.log('BedrockApiService: API response received via Amplify:', response);
        
        return {
          success: true,
          data: response
        };
      } catch (amplifyError) {
        // If Amplify API call fails, try direct axios call with explicit auth
        console.warn('BedrockApiService: Amplify API call failed, falling back to direct axios:', amplifyError);
        
        if (amplifyError.message && amplifyError.message.includes('Network Error')) {
          console.error('BedrockApiService: Network error detected:', amplifyError);
          return {
            success: false,
            message: 'Network error. Please check your internet connection and try again.'
          };
        }
        
        // Get a fresh token for the direct call
        try {
          const session = await Auth.currentSession();
          const token = session.getIdToken().getJwtToken();
          
          console.log('BedrockApiService: Making direct authenticated API call with axios');
          console.log('BedrockApiService: Token available:', !!token);
          
          const response = await axios.post(`${this.apiEndpoint}`, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('BedrockApiService: API Response via axios:', response);
          
          if (response.status !== 200 || !response.data || !response.data.success) {
            throw new Error(response.data?.message || 'Failed to analyze candidate profile');
          }
          
          return {
            success: true,
            data: response.data
          };
        } catch (authError) {
          console.error('BedrockApiService: Authentication error:', authError);
          return {
            success: false,
            message: 'Authentication error. Please log in again.',
            authError: true
          };
        }
      }
    } catch (error) {
      console.error('BedrockApiService: Error analyzing candidate:', error);
      
      // Handle auth errors
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.warn('BedrockApiService: Authentication error detected');
        return {
          success: false,
          message: 'Authentication error. Please log in again.',
          authError: true
        };
      }
      
      // Network errors
      if (error.message === 'Network Error') {
        console.error('BedrockApiService: Network error details:', {
          endpoint: this.apiEndpoint,
          error: error
        });
        
        return {
          success: false,
          message: 'Network error. Please check your internet connection and try again.'
        };
      }
      
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

// Create service instance
const bedrockApiService = new BedrockApiService();

// Export service instance
export default bedrockApiService; 
