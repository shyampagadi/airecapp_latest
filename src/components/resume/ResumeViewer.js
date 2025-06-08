import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Button,
  Divider,
  Grid,
  Link,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  GetApp as DownloadIcon,
  Email as EmailIcon,
  LinkedIn as LinkedInIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';

// PDF viewer component
const DocumentViewer = ({ url, fileType }) => {
  if (!url) {
    return (
      <Box 
        sx={{ 
          width: '100%', 
          height: '600px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: '1px solid #eee' 
        }}
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>Loading document...</Typography>
      </Box>
    );
  }

  console.log("Document viewer rendering with URL:", url);
  console.log("File type:", fileType);
  
  // For PDF files, use direct embedding
  if (fileType && fileType.toLowerCase() === 'pdf') {
  return (
      <Box sx={{ width: '100%', height: '600px', border: '1px solid #eee' }}>
      <iframe 
        src={`${url}#toolbar=0`} 
          width="100%"
          height="100%"
        title="Resume PDF Viewer" 
          style={{ border: 'none' }}
        />
      </Box>
    );
  }
  
  // For other file types (DOCX, DOC, etc.), use Google Docs Viewer
  return (
    <Box sx={{ width: '100%', height: '600px', border: '1px solid #eee' }}>
      <iframe
        src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
        width="100%"
        height="100%"
        title="Resume Document Viewer"
        style={{ border: 'none' }}
      />
    </Box>
  );
};

const ResumeViewer = ({ resumeId, resumeUrl, open, onClose, isLoading }) => {
  // Always declare state hooks at the top level, unconditionally
  const [personalInfo, setPersonalInfo] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);

  // Always declare useEffect hooks at the top level too, before any conditional returns
  useEffect(() => {
    // Only attempt to find resume data when component is open and resumeId exists
    if (open && resumeId) {
      console.log("ResumeViewer: Looking for resume data for ID:", resumeId);
      
      // First check if window.currentResumeResults exists
      if (!window.currentResumeResults) {
        console.warn("ResumeViewer: window.currentResumeResults is not defined");
        return;
      }
      
      console.log("ResumeViewer: Number of results available:", window.currentResumeResults.length);
      
      const result = window.currentResumeResults.find(r => r.resume_id === resumeId);
      if (result) {
        console.log("ResumeViewer: Found matching resume:", result.resume_id);
        setPersonalInfo(result.personal_info || {});
        setFileInfo(result.file_info || {});
        
        // Debug file info
        if (result.file_info) {
          console.log("ResumeViewer: File info found:", result.file_info);
        } else {
          console.warn("ResumeViewer: No file_info found in result");
        }
      } else {
        console.warn("ResumeViewer: Could not find resume with ID:", resumeId);
        console.log("ResumeViewer: Available resume IDs:", 
          window.currentResumeResults.map(r => r.resume_id).join(", "));
      }
    }
  }, [resumeId, open]);
  
  // Return early if not open, but AFTER declaring all hooks
  if (!open) return null;

  const handleDownload = () => {
    if (resumeUrl && fileInfo) {
      const link = document.createElement('a');
      link.href = resumeUrl;
      link.download = fileInfo.original_filename || `resume-${resumeId}.${fileInfo.file_type}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {personalInfo?.name || (window.currentResumeResults && 
              window.currentResumeResults.find(r => r.resume_id === resumeId)?.positions?.[0]) || 'Resume View'}
          </Typography>
        <IconButton onClick={onClose} size="small">
            <CloseIcon />
        </IconButton>
        </Box>
      </DialogTitle>
      
      <Divider />
      
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>Loading resume data...</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {/* Contact Information */}
            {personalInfo && (
              <Grid item xs={12}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Contact Information
                  </Typography>
                  <Grid container spacing={2}>
                    {personalInfo.email && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <EmailIcon sx={{ mr: 1 }} />
                          <Link href={`mailto:${personalInfo.email}`}>
                            {personalInfo.email}
                          </Link>
                        </Box>
                      </Grid>
                    )}
                    {personalInfo.phone_number && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PhoneIcon sx={{ mr: 1 }} />
                          <Typography>{personalInfo.phone_number}</Typography>
                        </Box>
                      </Grid>
                    )}
                    {personalInfo.address && (
                      <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LocationIcon sx={{ mr: 1 }} />
                          <Typography>{personalInfo.address}</Typography>
                          </Box>
                      </Grid>
                        )}
                    {personalInfo.linkedin_url && (
                      <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LinkedInIcon sx={{ mr: 1 }} />
                          <Link 
                            href={personalInfo.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            LinkedIn Profile
                          </Link>
                          </Box>
                      </Grid>
                    )}
                  </Grid>
                          </Box>
              </Grid>
                        )}
                      
            {/* Resume Document */}
            <Grid item xs={12}>
              {fileInfo && (
                        <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Resume Document
                          </Typography>
                  <Chip 
                    label={fileInfo.file_type?.toUpperCase()?.replace('.', '') || 'Document'} 
                    size="small" 
                    sx={{ mr: 1 }}
                  />
                              <Chip 
                    label={fileInfo.original_filename || 'Resume'} 
                                size="small" 
                                variant="outlined" 
                              />
                          </Box>
              )}
              <DocumentViewer url={resumeUrl} fileType={fileInfo?.file_type} />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      
      <DialogActions>
          <Button 
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
          disabled={isLoading || !resumeUrl}
          >
            Download
          </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResumeViewer; 