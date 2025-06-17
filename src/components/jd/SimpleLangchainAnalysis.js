import React, { useState } from 'react';
import { Button, Box, CircularProgress, Alert, Typography, Paper } from '@mui/material';
import { Auth } from 'aws-amplify';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import config from '../../config';

/**
 * A simplified component that demonstrates using LangChain with AWS Bedrock
 * for candidate analysis directly in the React app
 */
const SimpleLangchainAnalysis = ({ candidate, jobInfo }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Analyze the candidate using LangChain and Bedrock
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get AWS credentials from Amplify Auth
      const credentials = await Auth.currentCredentials();
      
      // Create BedrockChat model
      const model = new BedrockChat({
        model: 'meta.llama3-70b-instruct-v1:0',  // You can change this to any supported model
        region: config.region || 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
        modelKwargs: {
          max_gen_len: 512,
          temperature: 0.5,
          top_p: 0.9
        }
      });
      
      // Create a simple prompt
      const prompt = `
        Analyze this candidate for the job position:
        
        Candidate: ${JSON.stringify(candidate)}
        Job: ${JSON.stringify(jobInfo)}
        
        Provide a brief analysis of the candidate's fit for this position.
      `;
      
      console.log('Invoking Bedrock model...');
      const response = await model.invoke(prompt);
      
      setResult(response.content);
    } catch (err) {
      console.error('Error using LangChain with Bedrock:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="h6" gutterBottom>
        LangChain-Bedrock Analysis
      </Typography>
      
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleAnalyze} 
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Analyze with LangChain'}
      </Button>
      
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      
      {result && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Analysis Result:
          </Typography>
          <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-line' }}>
            {result}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default SimpleLangchainAnalysis; 