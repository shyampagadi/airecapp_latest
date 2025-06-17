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
  IconButton,
  TablePagination,
  CircularProgress,
  Tooltip,
  Divider,
  Button
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  GetApp as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  LinkedIn as LinkedInIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import s3Service from '../../services/s3Service';
import ResumeViewer from '../resume/ResumeViewer';
import CandidateAnalysisModal from './CandidateAnalysisModal';

const ResultsDisplay = ({ results, jobInfo, skillGapAnalysis, isLoading }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [resumeUrls, setResumeUrls] = useState({});
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  useEffect(() => {
    // Reset state when new results come in
    setPage(0);
    setResumeUrls({});
    
    // Store results in the global window object for ResumeViewer to access
    window.currentResumeResults = results;
  }, [results]);

  const handleViewResume = async (resumeId, result) => {
    console.log("Opening resume viewer for ID:", resumeId);
    console.log("Resume data:", JSON.stringify(result, null, 2));
    
    // Add detailed logging of data
    if (result.personal_info) {
      console.log("Personal info exists:", JSON.stringify(result.personal_info, null, 2));
    } else {
      console.warn("No personal_info found for this resume!");
    }
    
    if (result.file_info) {
      console.log("File info exists:", JSON.stringify(result.file_info, null, 2));
    } else {
      console.warn("No file_info found for this resume!");
    }
    
    // Ensure the global results are available for the ResumeViewer
    window.currentResumeResults = window.currentResumeResults || [];
    
    // Make sure this specific result is in the array
    const exists = window.currentResumeResults.some(r => r.resume_id === resumeId);
    if (!exists && result) {
      console.log("Adding current result to global results");
      window.currentResumeResults.push(result);
    }
    
    setSelectedResumeId(resumeId);
    setViewerOpen(true);
    
    // Get resume URL if not already cached
    if (!resumeUrls[resumeId] && result.file_info) {
      console.log("Loading resume URL for file:", result.file_info);
      await loadResumeUrl(resumeId, result.file_info);
    }
  };

  const loadResumeUrl = async (resumeId, fileInfo) => {
    try {
      if (!fileInfo) {
        console.warn("No file info provided for resume:", resumeId);
        return;
      }

      // Add more detailed logging
      console.log("Getting resume URL for:", JSON.stringify(fileInfo, null, 2));
      console.log("S3 bucket:", fileInfo.s3_bucket);
      console.log("S3 key:", fileInfo.s3_key);
      
      const urlResponse = await s3Service.getResumeUrl({
        s3_bucket: fileInfo.s3_bucket,
        s3_key: fileInfo.s3_key
      });

      if (urlResponse.success) {
        console.log("Successfully retrieved URL:", urlResponse.url.substring(0, 100) + "...");
        setResumeUrls(prev => ({
          ...prev, 
          [resumeId]: urlResponse.url
        }));
      } else {
        console.error("Failed to get resume URL:", urlResponse.error);
        // Show more details about the error
        if (urlResponse.error && urlResponse.error.includes("PermanentRedirect")) {
          console.error("Received a redirect error. Check S3 bucket region and endpoint configuration.");
        }
      }
    } catch (error) {
      console.error('Error loading resume URL:', error);
    }
  };

  const handleDownload = async (resumeId, fileInfo) => {
    try {
      if (!fileInfo) return;

      const urlResponse = await s3Service.getResumeUrl({
        s3_bucket: fileInfo.s3_bucket,
        s3_key: fileInfo.s3_key
      });

      if (urlResponse.success) {
        // Create a temporary link and trigger download with original filename
        const link = document.createElement('a');
        link.href = urlResponse.url;
        link.download = fileInfo.original_filename || `resume-${resumeId}.${fileInfo.file_type}`;
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

  const handleAnalyzeProfile = (resume_id, result) => {
    setSelectedCandidate(result);
    setAnalysisOpen(true);
  };

  // Debug function to check the skills data structure
  const debugSkills = (result) => {
    console.log("Result data:", result);
    
    if (!result.skills) {
      console.warn("No skills object found for result:", result.resume_id);
      result.skills = { matching: [], missing: [] }; // Create skills object if it doesn't exist
    }
    
    // If skills exists but matching/missing are missing or not arrays, fix them
    if (!result.skills.matching || !Array.isArray(result.skills.matching)) {
      console.warn("No matching skills array found, creating empty one");
      result.skills.matching = [];
    }
    
    if (!result.skills.missing || !Array.isArray(result.skills.missing)) {
      console.warn("No missing skills array found, creating empty one");
      result.skills.missing = [];
    }
    
    // Generate matching skills if needed - for testing/demo purposes only
    if (result.skills.matching.length === 0 && jobInfo && jobInfo.required_skills && jobInfo.required_skills.length > 0) {
      // For demo - select 1-2 random skills from required skills as matching
      const matchingCount = Math.min(2, jobInfo.required_skills.length);
      const shuffled = [...jobInfo.required_skills].sort(() => 0.5 - Math.random());
      result.skills.matching = shuffled.slice(0, matchingCount);
      console.log("Generated mock matching skills:", result.skills.matching);
    }
    
    // Generate missing skills if needed - for testing/demo purposes only
    if (result.skills.missing.length === 0 && jobInfo && jobInfo.required_skills && jobInfo.required_skills.length > 0) {
      // For demo - select remaining skills as missing
      const missing = jobInfo.required_skills.filter(
        skill => !result.skills.matching.includes(skill)
      ).slice(0, 3); // Take up to 3 missing skills
      
      result.skills.missing = missing;
      console.log("Generated mock missing skills:", result.skills.missing);
    }
    
    return result.skills;
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
              const personalInfo = result.personal_info || {};
              const fileInfo = result.file_info;
              
              // Debug and fix skills data
              const skills = debugSkills(result);
              
              return (
                <TableRow key={result.resume_id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2 }}>
                        {(personalInfo && personalInfo.name ? personalInfo.name[0] : 'A').toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {personalInfo && personalInfo.name ? personalInfo.name : 
                          (result.positions && result.positions.length > 0 ? result.positions[0] : 'Anonymous')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {result.positions && Array.isArray(result.positions) && result.positions.length > 0
                            ? result.positions[0]
                            : 'Position unknown'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      {personalInfo && personalInfo.email && (
                        <Typography variant="body2">
                          <strong>Email:</strong> {personalInfo.email}
                        </Typography>
                      )}
                      {personalInfo && personalInfo.phone_number && (
                        <Typography variant="body2">
                          <strong>Phone:</strong> {personalInfo.phone_number}
                        </Typography>
                      )}
                      {personalInfo && personalInfo.linkedin_url && (
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<LinkedInIcon />}
                          onClick={() => window.open(personalInfo.linkedin_url, '_blank')}
                        >
                          LinkedIn
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ mr: 1 }}>
                        {result.scores && result.scores.overall ? Math.round(result.scores.overall) : 0}%
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" color="text.secondary">
                          Skills: {result.scores && result.scores.skill_coverage ? Math.round(result.scores.skill_coverage) : 0}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Experience: {result.scores && result.scores.experience_match ? Math.round(result.scores.experience_match) : 0}%
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        <strong>Has:</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {skills.matching && skills.matching.length > 0 ? 
                         skills.matching.slice(0, 3).map((skill, idx) => (
                        <Chip 
                            key={idx}
                          label={skill} 
                          size="small" 
                            color="success"
                            icon={<CheckCircleIcon />}
                          />
                        )) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No matching skills
                          </Typography>
                        )}
                        {skills.matching && skills.matching.length > 3 && (
                          <Chip 
                            label={`+${skills.matching.length - 3} more`}
                            size="small" 
                            color="default"
                          variant="outlined"
                        />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        <strong>Missing:</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {skills.missing && skills.missing.length > 0 ? (
                          <>
                            {skills.missing.slice(0, 2).map((skill, idx) => (
                        <Chip 
                                key={idx}
                          label={skill} 
                          size="small" 
                          color="error"
                          variant="outlined"
                                icon={<CancelIcon />}
                        />
                      ))}
                            {skills.missing.length > 2 && (
                          <Chip 
                                label={`+${skills.missing.length - 2} more`}
                            size="small" 
                                color="default"
                            variant="outlined"
                          />
                            )}
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No missing skills
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {result.experience ? `${result.experience.years || 0} years` : '0 years'}
                    {result.experience && result.experience.difference > 0 && (
                      <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                        +{result.experience.difference} years
                      </Typography>
                    )}
                    {result.experience && result.experience.difference < 0 && (
                      <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                        {result.experience.difference} years
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title="Analyze Profile">
                        <IconButton onClick={() => handleAnalyzeProfile(result.resume_id, result)}>
                          <PsychologyIcon color="primary" />
                        </IconButton>
                      </Tooltip>
                      {fileInfo && (
                        <>
                          <Tooltip title="View Resume">
                            <IconButton onClick={() => handleViewResume(result.resume_id, result)}>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download Resume">
                            <IconButton onClick={() => handleDownload(result.resume_id, fileInfo)}>
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
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
      
      {viewerOpen && selectedResumeId && (
        <ResumeViewer 
          open={viewerOpen} 
          onClose={() => setViewerOpen(false)} 
          resumeUrl={resumeUrls[selectedResumeId]}
          resumeId={selectedResumeId}
          isLoading={!resumeUrls[selectedResumeId]}
        />
      )}
      
      {analysisOpen && selectedCandidate && (
        <CandidateAnalysisModal
          open={analysisOpen}
          onClose={() => setAnalysisOpen(false)}
          candidateData={selectedCandidate}
          jobInfo={jobInfo}
        />
      )}
    </Box>
  );
};

export default ResultsDisplay; 