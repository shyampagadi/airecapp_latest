import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import bedrockApiService from '../../services/bedrockApiService';
import axios from 'axios';
import { Auth } from 'aws-amplify';
import { API_GATEWAY } from '../../config/appConfig';

const CandidateAnalysisModal = ({ open, onClose, candidate, jobInfo }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  
  // Reset state when modal opens with a new candidate
  useEffect(() => {
    if (open && candidate) {
      setAnalysis(null);
      setError(null);
      setDiagnostics(null);
      
      // Automatically run the analysis when the modal opens
      handleAnalyze();
    }
  }, [open, candidate]);
  
  // Debug function to directly test the API endpoint
  const testApiConnection = async () => {
    setLoading(true);
    setError(null);
    setDiagnostics(null);
    
    try {
      // Get the API endpoint
      const endpoint = API_GATEWAY.bedrockAnalysisEndpoint;
      
      // Try a simple ping request
      const pingResult = await axios.get(`${endpoint}/ping`, {
        timeout: 5000
      }).catch(err => {
        // If the endpoint doesn't support GET or /ping, we'll get an error
        // This is expected, we just want to test connectivity
        return { status: err.response?.status || 'No response', error: err.message };
      });
      
      // Try to get authentication token
      let authStatus = 'Unknown';
      let token = null;
      try {
        const session = await Auth.currentSession();
        token = session.getIdToken().getJwtToken();
        authStatus = token ? 'Token available' : 'No token';
      } catch (authError) {
        authStatus = `Auth error: ${authError.message}`;
      }
      
      // Collect diagnostics
      const diagInfo = {
        endpoint: endpoint,
        pingResult: pingResult.status || 'Failed',
        authStatus: authStatus,
        tokenAvailable: !!token,
        timestamp: new Date().toISOString()
      };
      
      setDiagnostics(diagInfo);
      console.log('API Connection test results:', diagInfo);
      
    } catch (err) {
      console.error('Error testing API connection:', err);
      setError(`Connection test error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setDiagnostics(null);
    
    try {
      // Use the environment variable for model ID
      const result = await bedrockApiService.analyzeCandidate(
        candidate, 
        jobInfo, 
        { modelId: process.env.REACT_APP_BEDROCK_MODEL_ID }
      );
      
      if (result.success) {
        console.log('Analysis result from API:', result);
        
        // Parse the API response if needed
        let analysisData;
        try {
          // Extract the response data based on API Gateway Lambda integration pattern
          // The response structure is typically: { statusCode, headers, body }
          // Where body is a stringified JSON object containing the actual data
          
          if (typeof result.data === 'string') {
            // Direct string response
            analysisData = JSON.parse(result.data);
          } else if (result.data && result.data.body && typeof result.data.body === 'string') {
            // API Gateway format with stringified body
            const parsedBody = JSON.parse(result.data.body);
            analysisData = parsedBody.data; // Get the actual data from the success response
          } else if (result.data && result.data.body && typeof result.data.body === 'object') {
            // API Gateway format with parsed body
            analysisData = result.data.body.data;
          } else {
            // Direct object response
            analysisData = result.data;
          }
          
          console.log('Parsed analysis data:', analysisData);
          
          // If data is still nested, extract it
          if (analysisData && analysisData.data) {
            analysisData = analysisData.data;
          }
          
          // Handle different response structures
          // If the data structure has sections property in the expected format
          if (analysisData && analysisData.sections) {
            // Already in the right format, no need to change
            console.log('Found sections directly:', analysisData.sections);
          }
          // If the data is in the format from the API Gateway test
          else if (analysisData && analysisData.rawText && typeof analysisData.sections === 'object') {
            console.log('Found proper sections structure');
            // This is the correct format as seen in the API Gateway test
          }
          // If sections is nested deeper
          else {
            console.warn('Could not find expected sections structure, searching for alternatives');
            
            // Try various possible structures based on the API Gateway test data
            if (!analysisData) {
              analysisData = {};
            }
            
            if (!analysisData.sections) {
              analysisData.sections = {};
            }
            
            // Set default messages
            const defaultMsg = "No data available in API response. Check Raw Analysis Data below.";
            if (!analysisData.sections.executiveSummary) {
              analysisData.sections.executiveSummary = defaultMsg;
            }
            if (!analysisData.sections.scoreAnalysis) {
              analysisData.sections.scoreAnalysis = defaultMsg;
            }
            if (!analysisData.sections.keyStrengths) {
              analysisData.sections.keyStrengths = defaultMsg;
            }
            if (!analysisData.sections.areasForConsideration) {
              analysisData.sections.areasForConsideration = defaultMsg;
            }
            if (!analysisData.sections.interviewRecommendations) {
              analysisData.sections.interviewRecommendations = defaultMsg;
            }
            if (!analysisData.sections.finalRecommendation) {
              analysisData.sections.finalRecommendation = defaultMsg;
            }
          }
          
          // Keep the raw API response for debugging
          analysisData.rawApiResponse = result.data;
          
        } catch (parseError) {
          console.error('Error parsing API response:', parseError);
          // Create a basic analysis structure with the error
          analysisData = {
            sections: {
              executiveSummary: `Error parsing API response: ${parseError.message}. See Raw Analysis Data below.`,
              scoreAnalysis: "",
              keyStrengths: "",
              areasForConsideration: "",
              interviewRecommendations: "",
              finalRecommendation: ""
            },
            error: parseError.message,
            rawApiResponse: result.data
          };
        }
        
        console.log('Final processed analysis data:', analysisData);
        setAnalysis(analysisData);
      } else {
        // Handle authentication errors
        if (result.authError) {
          console.warn('Authentication error detected, redirecting to login');
          window.location.href = '/login';
          return;
        }
        
        setError(result.message || 'Analysis not available');
      }
    } catch (err) {
      console.error('Error in candidate analysis:', err);
      setError(`Analysis error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const renderSection = (title, content) => {
    if (!content) return null;
    
    // Clean up content - remove asterisks and extra newlines
    let cleanContent = content;
    if (typeof cleanContent === 'string') {
      // Remove ** markers often used for bold text in markdown
      cleanContent = cleanContent.replace(/\*\*/g, '');
      // Remove leading/trailing newlines
      cleanContent = cleanContent.trim();
      // Normalize multiple newlines to just double newlines
      cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n');
    }
    
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
          {title}
        </Typography>
        <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
          {cleanContent}
        </Typography>
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      scroll="paper"
      aria-labelledby="candidate-analysis-dialog-title"
    >
      <DialogTitle id="candidate-analysis-dialog-title">
        Candidate Analysis
        {candidate?.personal_info?.name && (
          <>: {candidate.personal_info.name}</>
        )}
      </DialogTitle>
      
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Analyzing candidate profile...
            </Typography>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {diagnostics && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">API Diagnostics:</Typography>
            <Typography variant="body2">Endpoint: {diagnostics.endpoint}</Typography>
            <Typography variant="body2">Ping Result: {diagnostics.pingResult}</Typography>
            <Typography variant="body2">Auth Status: {diagnostics.authStatus}</Typography>
            <Typography variant="body2">Token Available: {diagnostics.tokenAvailable ? 'Yes' : 'No'}</Typography>
            <Typography variant="body2">Time: {diagnostics.timestamp}</Typography>
          </Alert>
        )}
        
        {!loading && !error && analysis && (
          <Box>
            {analysis.sections ? (
              <>
                {renderSection('Executive Summary', analysis.sections.executiveSummary)}
                <Divider sx={{ my: 2 }} />
                
                {renderSection('Score Analysis', analysis.sections.scoreAnalysis)}
                <Divider sx={{ my: 2 }} />
                
                {renderSection('Key Strengths', analysis.sections.keyStrengths)}
                <Divider sx={{ my: 2 }} />
                
                {renderSection('Areas for Consideration', analysis.sections.areasForConsideration)}
                <Divider sx={{ my: 2 }} />
                
                {renderSection('Interview Recommendations', analysis.sections.interviewRecommendations)}
                <Divider sx={{ my: 2 }} />
                
                {renderSection('Final Recommendation', analysis.sections.finalRecommendation)}
              </>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Analysis data received but missing expected structure. Please try again.
              </Alert>
            )}
            
            {analysis.metadata && (
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Analysis Metadata</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" component="div">
                    <strong>Processing Time:</strong> {analysis.metadata?.processing_time_ms || 0}ms<br />
                    <strong>Generated At:</strong> {new Date().toLocaleString()}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
        
        {!loading && !error && !analysis && !diagnostics && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Initializing analysis...
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        {!loading && (
          <>
            <Button 
              onClick={handleAnalyze} 
              color="primary" 
              variant="outlined"
              disabled={loading}
            >
              Refresh Analysis
            </Button>
            <Button onClick={onClose} color="primary">
              Close
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CandidateAnalysisModal; 