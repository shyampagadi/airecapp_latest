import { API, Auth } from 'aws-amplify';
import axios from 'axios';
import { API_GATEWAY } from '../config/appConfig';

// Get API Gateway URL from config
const API_GATEWAY_URL = API_GATEWAY.jdSearchEndpoint;

export const submitJobDescription = async (jobDescriptionData, filters = {}) => {
  try {
    // Extract text content from HTML for API request
    const textContent = jobDescriptionData.replace(/<[^>]*>/g, ' ').trim();
    console.log('jdService: Extracted text content from HTML');

    // Process filters
    const {
      skills = [],
      min_experience,
      max_experience,
      min_score,
      location,
      education_level
    } = filters;

    // Try using Amplify API for authenticated calls first
    try {
      console.log('jdService: Using Amplify API for authenticated call');
      
      // Get the current session to verify we're authenticated
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      // Prepare query parameters
      const queryParams = {
        job_description: textContent
      };
      
      // Add filters to query parameters if provided
      if (skills && skills.length > 0) {
        queryParams.skills = skills.join(',');
      }
      
      if (min_experience !== undefined) {
        queryParams.min_experience = min_experience;
      }
      
      if (max_experience !== undefined) {
        queryParams.max_experience = max_experience;
      }
      
      if (min_score !== undefined) {
        queryParams.min_score = min_score;
      }
      
      if (location) {
        queryParams.location = location;
      }
      
      if (education_level) {
        queryParams.education_level = education_level;
      }
      
      // Make the API call using Amplify's API module
      const response = await API.get('jdSearchApi', '', {
        queryStringParameters: queryParams,
        headers: {
          'Content-Type': 'application/json'
          // Auth header is automatically added by Amplify
        }
      });
      
      console.log('jdService: API response received via Amplify:', response);
      
      return {
        success: true,
        data: response
      };
    } catch (amplifyError) {
      // If Amplify API call fails, try direct axios call with explicit auth
      console.warn('jdService: Amplify API call failed, falling back to direct axios:', amplifyError);
      
      // Get a fresh token for the direct call
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      console.log('jdService: Making direct authenticated API call with axios');
      
      // Prepare query parameters
      const params = {
        job_description: textContent
      };
      
      // Add filters to query parameters if provided
      if (skills && skills.length > 0) {
        params.skills = skills.join(',');
      }
      
      if (min_experience !== undefined) {
        params.min_experience = min_experience;
      }
      
      if (max_experience !== undefined) {
        params.max_experience = max_experience;
      }
      
      if (min_score !== undefined) {
        params.min_score = min_score;
      }
      
      if (location) {
        params.location = location;
      }
      
      if (education_level) {
        params.education_level = education_level;
      }
      
      const response = await axios.get(API_GATEWAY_URL, {
        params,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('jdService: API response received via axios:', response.data);
      
      // Check if response has the expected structure
      if (!response.data || (Array.isArray(response.data) && response.data.length === 0)) {
        console.warn('jdService: API returned empty response');
        return {
          success: true,
          data: [],
          message: 'No matching resumes found'
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    }
  } catch (error) {
    console.error('jdService: Error submitting job description:', error);
    
    // Handle specific API errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('jdService: API error response:', error.response);
      
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
        message: `API error (${error.response.status}): ${error.response.data && error.response.data.message ? error.response.data.message : 'Unknown error'}`
      };
    } else if (error.request) {
      // The request was made but no response was received
      console.error('jdService: No response from API');
      return {
        success: false,
        message: 'No response received from the server. Please check your network connection.'
      };
    } else {
      // Something happened in setting up the request
      return {
        success: false,
        message: error.message || 'Failed to submit job description'
      };
    }
  }
};

/**
 * Get resume processing statistics from OpenSearch
 * 
 * @returns {Promise<Object>} Statistics data or error
 */
export const getResumeStatistics = async () => {
  try {
    console.log('jdService: Fetching resume statistics');
    
    // Get authentication token
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Get statistics API endpoint
    const statisticsUrl = `${API_GATEWAY_URL}/statistics`;
    
    const response = await axios.get(statisticsUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('jdService: Statistics retrieved successfully');
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('jdService: Error retrieving statistics:', error);
    
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
        message: error.message || 'Failed to retrieve statistics'
      };
    }
  }
}; 