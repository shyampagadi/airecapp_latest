import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  Paper,
  CircularProgress,
  Divider,
  TextField,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import axios from 'axios';
import { API_GATEWAY } from '../../config/appConfig';
import { Auth, API } from 'aws-amplify';

const BedrockApiTest = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [customEndpoint, setCustomEndpoint] = useState('');
  
  useEffect(() => {
    // Load endpoint from config on mount
    setCustomEndpoint(API_GATEWAY.bedrockAnalysisEndpoint || '');
  }, []);
  
  const runTest = async (testName, testFn) => {
    try {
      setLoading(true);
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      setResults(prev => [
        {
          name: testName,
          success: true,
          data: result,
          duration,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
      
      return result;
    } catch (err) {
      console.error(`Test ${testName} failed:`, err);
      
      setResults(prev => [
        {
          name: testName,
          success: false,
          error: err.message || 'Unknown error',
          duration: Date.now() - (err.startTime || Date.now()),
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
      
      setError(`Test "${testName}" failed: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  const testHttpsEndpoint = async () => {
    const endpoint = customEndpoint || API_GATEWAY.bedrockAnalysisEndpoint;
    
    if (!endpoint) {
      throw new Error('No API endpoint configured');
    }
    
    try {
      // First try a simple OPTIONS request
      const optionsResult = await axios({
        method: 'OPTIONS',
        url: endpoint,
        timeout: 5000
      }).catch(err => {
        return {
          status: err.response?.status || 'No response',
          message: err.message,
          headers: err.response?.headers
        };
      });
      
      // Then try a simple GET request
      const getResult = await axios({
        method: 'GET',
        url: endpoint,
        timeout: 5000
      }).catch(err => {
        return {
          status: err.response?.status || 'No response',
          message: err.message,
          headers: err.response?.headers
        };
      });
      
      return {
        endpoint,
        options: optionsResult,
        get: getResult
      };
    } catch (err) {
      throw new Error(`Failed to connect to ${endpoint}: ${err.message}`);
    }
  };
  
  const testAmplifyApi = async () => {
    try {
      // Check if we have an active session
      const session = await Auth.currentSession();
      // Get token but just use it to verify we're authenticated
      const isAuthenticated = !!(session && session.getIdToken().getJwtToken());
      
      // Try to make a minimal request to the API
      try {
        const response = await API.get('bedrockAnalysisApi', '', {});
        return {
          method: 'GET',
          status: 'success',
          isAuthenticated,
          response
        };
      } catch (apiError) {
        // API calls usually fail with 4xx errors because we're not sending the right payload
        // That's actually good - it means the endpoint exists and is responding
        return {
          method: 'GET',
          status: 'error',
          isAuthenticated,
          message: apiError.message,
          response: apiError.response
        };
      }
    } catch (authError) {
      throw new Error(`Authentication error: ${authError.message}`);
    }
  };
  
  const testDirectApiPost = async () => {
    const endpoint = customEndpoint || API_GATEWAY.bedrockAnalysisEndpoint;
    
    try {
      // Get auth token
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      
      // Create a minimal test payload
      const payload = {
        candidateData: {
          personal_info: {
            name: "Test User"
          },
          skills: {
            matching: ["JavaScript", "React"],
            missing: ["AWS"]
          },
          experience: {
            years: 3
          }
        },
        jobInfo: {
          job_title: "Test Job",
          required_skills: ["JavaScript", "React", "AWS"]
        },
        modelId: "meta.llama3-8b-instruct-v1:0",
        parameters: {
          max_gen_len: 100,
          temperature: 0.5
        }
      };
      
      // Try to make a direct POST request
      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 5000
        });
        
        return {
          method: 'POST',
          status: 'success',
          response: response.data
        };
      } catch (apiError) {
        return {
          method: 'POST',
          status: 'error',
          message: apiError.message,
          response: apiError.response?.data
        };
      }
    } catch (err) {
      throw new Error(`Failed to make direct API call: ${err.message}`);
    }
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Bedrock API Connection Test
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mb: 3 }}>
          <TextField
            label="API Endpoint"
            value={customEndpoint}
            onChange={(e) => setCustomEndpoint(e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
            helperText="Enter a custom API endpoint or leave blank to use configured value"
          />
          
          <Typography variant="body2" color="text.secondary" paragraph>
            Current configured endpoint: {API_GATEWAY.bedrockAnalysisEndpoint || 'Not configured'}
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <Button 
            variant="contained" 
            onClick={() => runTest('HTTPS Endpoint Test', testHttpsEndpoint)}
            disabled={loading}
          >
            Test HTTPS Endpoint
          </Button>
          
          <Button 
            variant="contained" 
            color="secondary"
            onClick={() => runTest('Amplify API Test', testAmplifyApi)}
            disabled={loading}
          >
            Test Amplify API
          </Button>
          
          <Button 
            variant="contained" 
            color="success"
            onClick={() => runTest('Direct API POST Test', testDirectApiPost)}
            disabled={loading}
          >
            Test Direct API POST
          </Button>
        </Box>
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        )}
        
        <Typography variant="h6" gutterBottom>
          Test Results
        </Typography>
        
        <List>
          {results.map((result, index) => (
            <ListItem key={index} divider>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1">
                      {result.name} {result.success ? '✅' : '❌'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {result.duration}ms - {new Date(result.timestamp).toLocaleTimeString()}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    {result.success ? (
                      <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '150px' }}>
                        {JSON.stringify(result.data, null, 2)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="error">
                        {result.error}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
          
          {results.length === 0 && (
            <ListItem>
              <ListItemText primary="No tests run yet" />
            </ListItem>
          )}
        </List>
      </Paper>
    </Container>
  );
};

export default BedrockApiTest; 