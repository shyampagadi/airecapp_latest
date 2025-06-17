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
import langchainBedrockService from '../../services/langchainBedrockService';

const CandidateAnalysisModal = ({ open, onClose, candidate, jobInfo }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Reset state when modal opens with a new candidate
  useEffect(() => {
    if (open && candidate) {
      setAnalysis(null);
      setError(null);
    }
  }, [open, candidate]);
  
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the environment variable for model ID
      const result = await langchainBedrockService.analyzeCandidate(
        candidate, 
        jobInfo, 
        { modelId: process.env.REACT_APP_BEDROCK_MODEL_ID }
      );
      
      if (result.success) {
        setAnalysis(result.data);
      } else {
        setError(result.message || 'Analysis not available');
      }
    } catch (err) {
      console.error('Error in candidate analysis:', err);
      setError('Analysis not available');
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
        {!analysis && !loading && (
          <Box sx={{ mb: 3 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleAnalyze} 
              disabled={loading}
              fullWidth
            >
              Analyze Candidate
            </Button>
          </Box>
        )}
        
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
                    <strong>Processing Time:</strong> {analysis.metadata?.processing_time_ms || 0}ms<br />
                    <strong>Generated At:</strong> {new Date().toLocaleString()}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
        
        {!loading && !error && !analysis && (
          <Alert severity="info">
            Click "Analyze Candidate" to generate a professional analysis.
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        {analysis && (
          <Button 
            onClick={handleAnalyze} 
            color="primary" 
            variant="outlined"
            disabled={loading}
          >
            Analyze Again
          </Button>
        )}
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CandidateAnalysisModal; 