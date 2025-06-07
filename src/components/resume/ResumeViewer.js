import React from 'react';
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
  Chip
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
const PDFViewer = ({ url }) => {
  if (!url) return null;
  
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
};

const ResumeViewer = ({ resumeId, resumeUrl, piiData, open, onClose }) => {
  if (!open) return null;

  const handleDownload = () => {
    if (resumeUrl) {
      const link = document.createElement('a');
      link.href = resumeUrl;
      link.download = piiData?.original_filename || `resume-${resumeId}${piiData?.file_type}`;
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
            {piiData?.name || 'Resume View'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Grid container spacing={2}>
          {/* Contact Information */}
          <Grid item xs={12}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Contact Information
              </Typography>
              <Grid container spacing={2}>
                {piiData?.email && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <EmailIcon sx={{ mr: 1 }} />
                      <Link href={`mailto:${piiData.email}`}>
                        {piiData.email}
                      </Link>
                    </Box>
                  </Grid>
                )}
                {piiData?.phone_number && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PhoneIcon sx={{ mr: 1 }} />
                      <Typography>{piiData.phone_number}</Typography>
                    </Box>
                  </Grid>
                )}
                {piiData?.address && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LocationIcon sx={{ mr: 1 }} />
                      <Typography>{piiData.address}</Typography>
                    </Box>
                  </Grid>
                )}
                {piiData?.linkedin_url && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LinkedInIcon sx={{ mr: 1 }} />
                      <Link 
                        href={piiData.linkedin_url}
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

          {/* Resume Document */}
          <Grid item xs={12}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Resume Document
              </Typography>
              <Chip 
                label={piiData?.file_type?.toUpperCase()?.replace('.', '') || 'Document'} 
                size="small" 
                sx={{ mr: 1 }}
              />
              <Chip 
                label={piiData?.original_filename || 'Resume'} 
                size="small"
                variant="outlined"
              />
            </Box>
            <PDFViewer url={resumeUrl} />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button 
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          disabled={!resumeUrl}
        >
          Download
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResumeViewer; 