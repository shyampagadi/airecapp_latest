import axios from 'axios';
import { Auth } from 'aws-amplify';
import { API_GATEWAY } from '../config/appConfig';

// API Gateway URL for PostgreSQL data from config
const POSTGRES_API_URL = API_GATEWAY.postgresEndpoint;

/**
 * Get candidate PII data from PostgreSQL by resume ID
 * 
 * @param {string} resumeId - The resume ID to lookup
 * @returns {Promise<Object>} - The candidate data or error
 */
export const getCandidateDataById = async (resumeId) => {
  try {
    console.log('postgresService: Fetching candidate data for resume ID:', resumeId);
    
    // Get authentication token
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Make API request
    const response = await axios.get(`${POSTGRES_API_URL}/candidate/${resumeId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('postgresService: Candidate data retrieved successfully');
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('postgresService: Error retrieving candidate data:', error);
    
    // Handle specific API errors
    if (error.response) {
      // Handle auth specific errors
      if (error.response.status === 401 || error.response.status === 403) {
        return {
          success: false,
          message: 'Authentication failed. Please log in again.',
          authError: true
        };
      }
      
      return {
        success: false,
        message: `API error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        success: false,
        message: 'No response received from the server. Please check your network connection.'
      };
    } else {
      // Something happened in setting up the request
      return {
        success: false,
        message: error.message || 'Failed to retrieve candidate data'
      };
    }
  }
};

/**
 * Get all candidates with pagination
 * 
 * @param {number} page - The page number (1-based)
 * @param {number} limit - Number of results per page
 * @param {Object} filters - Optional filters for the query
 * @returns {Promise<Object>} - The paginated candidates or error
 */
export const getCandidates = async (page = 1, limit = 10, filters = {}) => {
  try {
    console.log('postgresService: Fetching candidates list');
    
    // Get authentication token
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...filters
    });
    
    // Make API request
    const response = await axios.get(`${POSTGRES_API_URL}/candidates?${queryParams}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('postgresService: Candidates retrieved successfully');
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('postgresService: Error retrieving candidates:', error);
    
    // Handle specific API errors
    if (error.response) {
      // Handle auth specific errors
      if (error.response.status === 401 || error.response.status === 403) {
        return {
          success: false,
          message: 'Authentication failed. Please log in again.',
          authError: true
        };
      }
      
      return {
        success: false,
        message: `API error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        success: false,
        message: 'No response received from the server. Please check your network connection.'
      };
    } else {
      // Something happened in setting up the request
      return {
        success: false,
        message: error.message || 'Failed to retrieve candidates'
      };
    }
  }
};

/**
 * Get candidate resume from S3 by resume ID
 * 
 * @param {string} resumeId - The resume ID to lookup
 * @returns {Promise<Object>} - The presigned URL for the resume or error
 */
export const getResumePresignedUrl = async (resumeId) => {
  try {
    console.log('postgresService: Getting presigned URL for resume ID:', resumeId);
    
    // Get authentication token
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Make API request
    const response = await axios.get(`${POSTGRES_API_URL}/resume/${resumeId}/url`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('postgresService: Presigned URL generated successfully');
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('postgresService: Error getting presigned URL:', error);
    
    // Handle specific API errors
    if (error.response) {
      // Handle auth specific errors
      if (error.response.status === 401 || error.response.status === 403) {
        return {
          success: false,
          message: 'Authentication failed. Please log in again.',
          authError: true
        };
      }
      
      return {
        success: false,
        message: `API error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        success: false,
        message: 'No response received from the server. Please check your network connection.'
      };
    } else {
      // Something happened in setting up the request
      return {
        success: false,
        message: error.message || 'Failed to get resume URL'
      };
    }
  }
};

/**
 * Send email to candidate
 * 
 * @param {string} resumeId - The resume ID of the candidate
 * @param {string} subject - Email subject
 * @param {string} body - Email body content
 * @returns {Promise<Object>} - Success or error status
 */
export const sendEmailToCandidate = async (resumeId, subject, body) => {
  try {
    console.log('postgresService: Sending email to candidate with resume ID:', resumeId);
    
    // Get authentication token
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Make API request
    const response = await axios.post(
      `${POSTGRES_API_URL}/candidate/${resumeId}/email`,
      { subject, body },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('postgresService: Email sent successfully');
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('postgresService: Error sending email:', error);
    
    // Handle specific API errors
    if (error.response) {
      // Handle auth specific errors
      if (error.response.status === 401 || error.response.status === 403) {
        return {
          success: false,
          message: 'Authentication failed. Please log in again.',
          authError: true
        };
      }
      
      return {
        success: false,
        message: `API error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        success: false,
        message: 'No response received from the server. Please check your network connection.'
      };
    } else {
      // Something happened in setting up the request
      return {
        success: false,
        message: error.message || 'Failed to send email'
      };
    }
  }
}; 