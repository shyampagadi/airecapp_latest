import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  CircularProgress, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  Skeleton,
  Stack,
  Divider,
  Card,
  CardContent,
  Chip,
  Tooltip,
  Tab,
  Tabs
} from '@mui/material';
import {
  Close as CloseIcon,
  GetApp as DownloadIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  MailOutline as MailOutlineIcon
} from '@mui/icons-material';
import { getResumePresignedUrl, getCandidateDataById } from '../../services/postgresService';

// External component to render PDFs (will require 'react-pdf' package)
// This is a placeholder implementation
const PDFViewer = ({ url }) => {
  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 500 }}>
      <iframe 
        src={`${url}#toolbar=0`} 
        title="Resume PDF Viewer" 
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </Box>
  );
};

const ResumeViewer = ({ resumeId, open, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [candidateData, setCandidateData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Use useCallback to define the function
  const loadResumeData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get the presigned URL for the resume
      const urlResult = await getResumePresignedUrl(resumeId);
      if (!urlResult.success) {
        setError(urlResult.message || 'Failed to retrieve resume file');
        setLoading(false);
        return;
      }
      
      setResumeUrl(urlResult.data.url);
      
      // Get candidate data
      const candidateResult = await getCandidateDataById(resumeId);
      if (candidateResult.success) {
        setCandidateData(candidateResult.data);
      } else {
        console.warn('Unable to load candidate data:', candidateResult.message);
      }
    } catch (err) {
      console.error('Error loading resume data:', err);
      setError('An unexpected error occurred while loading the resume');
    } finally {
      setLoading(false);
    }
  }, [resumeId]); // Include resumeId in dependency array

  useEffect(() => {
    if (open && resumeId) {
      loadResumeData();
    }
  }, [open, resumeId, loadResumeData]);

  const handleDownload = () => {
    if (resumeUrl) {
      window.open(resumeUrl, '_blank');
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Helper function to format date string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6">Resume Viewer</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      
      <Divider />
      
      <Box sx={{ px: 3, pt: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Resume" />
          <Tab label="Candidate Info" />
        </Tabs>
      </Box>
      
      <DialogContent sx={{ flex: 1, overflow: 'auto', pt: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body1">Loading resume...</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : (
          activeTab === 0 ? (
            // Resume View
            <Paper elevation={0} sx={{ p: 2, height: '100%' }}>
              {resumeUrl ? (
                <PDFViewer url={resumeUrl} />
              ) : (
                <Alert severity="warning">No resume file available</Alert>
              )}
            </Paper>
          ) : (
            // Candidate Info View
            <Box>
              {candidateData ? (
                <>
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Box 
                          sx={{ 
                            width: 60, 
                            height: 60, 
                            borderRadius: '50%', 
                            bgcolor: 'primary.light', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            mr: 2
                          }}
                        >
                          <PersonIcon sx={{ color: 'primary.main', fontSize: 30 }} />
                        </Box>
                        <Box>
                          <Typography variant="h5" fontWeight="bold">
                            {candidateData.name || 'Candidate Name'}
                          </Typography>
                          <Typography variant="body1" color="text.secondary">
                            {candidateData.title || 'Position'}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                        {candidateData.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <MailOutlineIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                            <Typography variant="body2">{candidateData.email}</Typography>
                          </Box>
                        )}
                        
                        {candidateData.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PhoneIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                            <Typography variant="body2">{candidateData.phone}</Typography>
                          </Box>
                        )}
                        
                        {candidateData.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LocationIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                            <Typography variant="body2">{candidateData.location}</Typography>
                          </Box>
                        )}
                      </Box>
                      
                      {candidateData.skills && candidateData.skills.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Skills
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {candidateData.skills.map((skill, index) => (
                              <Chip 
                                key={index} 
                                label={skill} 
                                size="small" 
                                color="primary" 
                                variant="outlined" 
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                  
                  {candidateData.experience && candidateData.experience.length > 0 && (
                    <Card sx={{ mb: 3 }}>
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <WorkIcon sx={{ mr: 1 }} /> Experience
                        </Typography>
                        
                        {candidateData.experience.map((exp, index) => (
                          <Box key={index} sx={{ mb: index < candidateData.experience.length - 1 ? 3 : 0 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {exp.title} at {exp.company}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(exp.startDate)} - {exp.endDate ? formatDate(exp.endDate) : 'Present'}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {exp.description || 'No description provided'}
                            </Typography>
                            {index < candidateData.experience.length - 1 && (
                              <Divider sx={{ mt: 2 }} />
                            )}
                          </Box>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  
                  {candidateData.education && candidateData.education.length > 0 && (
                    <Card>
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <SchoolIcon sx={{ mr: 1 }} /> Education
                        </Typography>
                        
                        {candidateData.education.map((edu, index) => (
                          <Box key={index} sx={{ mb: index < candidateData.education.length - 1 ? 3 : 0 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {edu.degree} - {edu.institution}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(edu.startDate)} - {edu.endDate ? formatDate(edu.endDate) : 'Present'}
                            </Typography>
                            {edu.description && (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {edu.description}
                              </Typography>
                            )}
                            {index < candidateData.education.length - 1 && (
                              <Divider sx={{ mt: 2 }} />
                            )}
                          </Box>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Alert severity="info">No candidate information available</Alert>
              )}
            </Box>
          )
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Resume ID: {resumeId}
          </Typography>
        </Box>
        <Box>
          <Button 
            variant="outlined"
            startIcon={<PrintIcon />}
            disabled={loading || !!error || !resumeUrl}
            onClick={() => window.print()}
            sx={{ mr: 1 }}
          >
            Print
          </Button>
          <Button 
            variant="outlined"
            startIcon={<EmailIcon />}
            disabled={loading || !!error}
            sx={{ mr: 1 }}
          >
            Email
          </Button>
          <Button 
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={loading || !!error || !resumeUrl}
            onClick={handleDownload}
          >
            Download
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ResumeViewer; 