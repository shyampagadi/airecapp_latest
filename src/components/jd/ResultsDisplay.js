import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Paper,
  Avatar,
  LinearProgress,
  IconButton,
  TablePagination,
  CircularProgress,
  Tooltip,
  Divider,
  Link
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  GetApp as DownloadIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  LinkedIn as LinkedInIcon
} from '@mui/icons-material';
import postgresService from '../../services/postgresService';
import s3Service from '../../services/s3Service';
import ResumeViewer from '../resume/ResumeViewer';

const ResultsDisplay = ({ results, jobInfo, skillGapAnalysis, isLoading }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [piiData, setPiiData] = useState({});
  const [loadingPii, setLoadingPii] = useState({});
  const [resumeUrls, setResumeUrls] = useState({});

  useEffect(() => {
    // Reset state when new results come in
    setPage(0);
    setPiiData({});
    setLoadingPii({});
    setResumeUrls({});
    
    // Load PII data for all results in batch
    if (results && results.length > 0) {
      loadBatchPiiData(results.map(r => r.resume_id));
    }
  }, [results]);

  const loadBatchPiiData = async (resumeIds) => {
    try {
      const response = await postgresService.getPIIDataBatchByResumeIds(resumeIds);
      if (response.success) {
        const newPiiData = {};
        response.data.forEach(pii => {
          newPiiData[pii.resume_id] = pii;
        });
        setPiiData(newPiiData);
      }
    } catch (error) {
      console.error('Error loading batch PII data:', error);
    }
  };

  const handleViewResume = async (resumeId) => {
    setSelectedResumeId(resumeId);
    setViewerOpen(true);
    
    // Get resume URL if not already cached
    if (!resumeUrls[resumeId]) {
      await loadResumeUrl(resumeId);
    }
  };

  const loadResumeUrl = async (resumeId) => {
    try {
      const piiInfo = piiData[resumeId];
      if (!piiInfo) return;

      const urlResponse = await s3Service.getResumeUrl({
        s3_bucket: piiInfo.s3_bucket,
        s3_key: piiInfo.s3_key
      });

      if (urlResponse.success) {
        setResumeUrls(prev => ({
          ...prev,
          [resumeId]: urlResponse.url
        }));
      }
    } catch (error) {
      console.error('Error loading resume URL:', error);
    }
  };

  const handleDownload = async (resumeId) => {
    try {
      const piiInfo = piiData[resumeId];
      if (!piiInfo) return;

      const urlResponse = await s3Service.getResumeUrl({
        s3_bucket: piiInfo.s3_bucket,
        s3_key: piiInfo.s3_key
      });

      if (urlResponse.success) {
        // Create a temporary link and trigger download with original filename
        const link = document.createElement('a');
        link.href = urlResponse.url;
        link.download = piiInfo.original_filename || `resume-${resumeId}${piiInfo.file_type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading resume:', error);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Processing your search...
        </Typography>
      </Box>
    );
  }

  if (!results || !results.length) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No matching resumes found. Try adjusting your search criteria.
        </Alert>
      </Box>
    );
  }

  const displayedResults = results.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {jobInfo && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Job Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Required Experience:
                </Typography>
                <Typography variant="body1">
                  {jobInfo.required_experience ? `${jobInfo.required_experience} years` : 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Required Skills:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {jobInfo.required_skills ? 
                    jobInfo.required_skills.map((skill, idx) => (
                      <Chip key={idx} label={skill} size="small" color="primary" variant="outlined" />
                    ))
                    :
                    <Typography variant="body2">No specific skills listed</Typography>
                  }
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Typography variant="h6" gutterBottom>
        {results.length} matching resumes found
      </Typography>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>Candidate</TableCell>
              <TableCell>Contact Info</TableCell>
              <TableCell>Match Score</TableCell>
              <TableCell>Skills</TableCell>
              <TableCell>Experience</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedResults.map((result) => {
              const candidatePii = piiData[result.resume_id] || {};
              
              return (
                <TableRow key={result.resume_id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2 }}>
                        {(candidatePii?.name || 'A')[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {candidatePii?.name || 'Loading...'}
                        </Typography>
                        {result.positions && result.positions.length > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            {result.positions[0]}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      {candidatePii?.email && (
                        <Typography variant="body2">
                          <EmailIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                          {candidatePii.email}
                        </Typography>
                      )}
                      {candidatePii?.phone_number && (
                        <Typography variant="body2">
                          📞 {candidatePii.phone_number}
                        </Typography>
                      )}
                      {candidatePii?.linkedin_url && (
                        <Link 
                          href={candidatePii.linkedin_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}
                        >
                          <LinkedInIcon fontSize="small" sx={{ mr: 0.5 }} />
                          LinkedIn Profile
                        </Link>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LinearProgress
                        variant="determinate"
                        value={result.score * 100}
                        sx={{ width: 100, mr: 1 }}
                      />
                      <Typography variant="body2">
                        {Math.round(result.score * 100)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {result.matching_skills?.slice(0, 3).map((skill, idx) => (
                        <Chip
                          key={idx}
                          label={skill}
                          size="small"
                          color="success"
                          icon={<CheckCircleIcon />}
                        />
                      ))}
                      {result.missing_skills?.slice(0, 2).map((skill, idx) => (
                        <Chip
                          key={idx}
                          label={skill}
                          size="small"
                          color="error"
                          icon={<CancelIcon />}
                        />
                      ))}
                      {((result.matching_skills?.length > 3) || (result.missing_skills?.length > 2)) && (
                        <Tooltip title={[
                          ...(result.matching_skills || []).slice(3).map(s => `✓ ${s}`),
                          ...(result.missing_skills || []).slice(2).map(s => `✗ ${s}`)
                        ].join(', ')}>
                          <Chip 
                            label={`+${(result.matching_skills?.length || 0) - 3 + (result.missing_skills?.length || 0) - 2}`} 
                            size="small" 
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {result.total_experience ? `${result.total_experience} years` : 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Resume">
                      <IconButton 
                        size="small" 
                        onClick={() => handleViewResume(result.resume_id)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download Resume">
                      <IconButton 
                        size="small"
                        onClick={() => handleDownload(result.resume_id)}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Contact Candidate">
                      <IconButton 
                        size="small"
                        href={`mailto:${candidatePii?.email}`}
                        disabled={!candidatePii?.email}
                      >
                        <EmailIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={results.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <ResumeViewer 
        resumeId={selectedResumeId}
        resumeUrl={resumeUrls[selectedResumeId]}
        piiData={piiData[selectedResumeId]}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </Box>
  );
};

export default ResultsDisplay; 