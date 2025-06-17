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
import bedrockApiService from '../../services/bedrock-api-service';
import ModelSelector from './ModelSelector';

const CandidateAnalysisModal = ({ open, onClose, candidate, jobInfo }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelParameters, setModelParameters] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    // Do nothing if modal is not open or no model selected
    if (!open || !selectedModel || !candidate) return;
    
    // Analyze on model selection or parameter change
    handleAnalyze();
  }, [open, selectedModel, candidate]);
  
  const handleAnalyze = async () => {
    if (!selectedModel) {
      setError("Please select a model first");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Use the candidateAnalysisService to analyze the candidate
      const result = await bedrockApiService.analyzeCandidate(
        candidate, 
        jobInfo, 
        {
          modelId: selectedModel,
          parameters: modelParameters
        }
      );
      
      if (result.success) {
        setAnalysis(result.data);
      } else {
        setError(result.message || 'Failed to analyze candidate profile');
      }
    } catch (err) {
      console.error('Error in candidate analysis:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const renderSection = (title, content) => {
    if (!content) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
          {title}
        </Typography>
        <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-line' }}>
          {content}
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
        <Box sx={{ mb: 3 }}>
          <Button 
            variant="outlined" 
            color="primary" 
            onClick={() => setShowAdvanced(!showAdvanced)}
            sx={{ mb: 2 }}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </Button>
          
          {showAdvanced && (
            <ModelSelector 
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              modelParameters={modelParameters}
              setModelParameters={setModelParameters}
            />
          )}
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleAnalyze} 
            disabled={loading || !selectedModel}
            fullWidth
          >
            {loading ? 'Analyzing...' : analysis ? 'Analyze Again' : 'Analyze Candidate'}
          </Button>
        </Box>
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {!loading && !error && analysis && (
          <Box>
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
            
            {analysis.metadata && (
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Analysis Metadata</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" component="div">
                    <strong>Model:</strong> {analysis.metadata?.model || 'Not specified'}<br />
                    <strong>Processing Time:</strong> {analysis.metadata?.processing_time_ms || 0}ms<br />
                    <strong>Generated At:</strong> {new Date().toLocaleString()}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
        
        {!loading && !error && !analysis && !selectedModel && (
          <Alert severity="info">
            Please select a model to analyze this candidate.
          </Alert>
        )}
        
        {!loading && !error && !analysis && selectedModel && (
          <Alert severity="info">
            Click "Analyze Candidate" to generate a professional analysis.
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CandidateAnalysisModal; 