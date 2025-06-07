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
  Divider
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  GetApp as DownloadIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { getCandidateDataById } from '../../services/postgresService';
import ResumeViewer from '../resume/ResumeViewer';

const ResultsDisplay = ({ results, jobInfo, skillGapAnalysis, isLoading }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState({});
  const [loadingCandidates, setLoadingCandidates] = useState({});

  useEffect(() => {
    // Reset state when new results come in
    setPage(0);
    setCandidateDetails({});
    setLoadingCandidates({});
  }, [results]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewResume = async (resumeId) => {
    setSelectedResumeId(resumeId);
    setViewerOpen(true);
    
    // Load candidate data if not already loaded
    if (!candidateDetails[resumeId] && !loadingCandidates[resumeId]) {
      await loadCandidateData(resumeId);
    }
  };
  
  const loadCandidateData = async (resumeId) => {
    // Set loading state for this specific resume
    setLoadingCandidates(prev => ({ ...prev, [resumeId]: true }));
    
    try {
      const response = await getCandidateDataById(resumeId);
      
      if (response.success) {
        setCandidateDetails(prev => ({ 
          ...prev, 
          [resumeId]: response.data 
        }));
      } else {
        console.error('Failed to load candidate data:', response.message);
      }
    } catch (error) {
      console.error('Error loading candidate data:', error);
    } finally {
      setLoadingCandidates(prev => ({ ...prev, [resumeId]: false }));
    }
  };

  // Calculate top skills from all resumes
  const getTopSkills = () => {
    if (!results || !Array.isArray(results) || results.length === 0) return [];
    
    // Count occurrence of each skill
    const skillCount = {};
    results.forEach(result => {
      if (result.matching_skills) {
        result.matching_skills.forEach(skill => {
          skillCount[skill] = (skillCount[skill] || 0) + 1;
        });
      }
    });
    
    // Convert to array, sort by count, and take top 5
    return Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill]) => skill);
  };
  
  // Calculate experience range
  const getExperienceRange = () => {
    if (!results || !Array.isArray(results) || results.length === 0) return '0-0 years';
    
    const experiences = results
      .map(result => Number(result.experience))
      .filter(years => !isNaN(years));
    
    if (experiences.length === 0) return 'N/A';
    
    const min = Math.min(...experiences);
    const max = Math.max(...experiences);
    
    return `${min}-${max} years`;
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

  // Get current page of results
  const displayedResults = results.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  // Get top skills
  const topSkills = getTopSkills();

  return (
    <Box>
      {jobInfo && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {jobInfo.title || 'Job Details'}
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
      
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Average Match Score
              </Typography>
              <Typography variant="h4">
                {(results.reduce((sum, result) => sum + (result.score || 0), 0) / results.length).toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Top Skills
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {topSkills.map((skill, index) => (
                  <Chip key={index} label={skill} size="small" />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Experience Range
              </Typography>
              <Typography variant="h4">
                {getExperienceRange()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {skillGapAnalysis && skillGapAnalysis.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Skill Gap Analysis
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Skill</TableCell>
                    <TableCell>Missing Count</TableCell>
                    <TableCell>Missing %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {skillGapAnalysis.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.skill}</TableCell>
                      <TableCell>{item.missing_count}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: '100px', mr: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={item.missing_percent} 
                              color={item.missing_percent > 70 ? "error" : item.missing_percent > 40 ? "warning" : "success"} 
                              sx={{ height: 8, borderRadius: 5 }}
                            />
                          </Box>
                          <Typography variant="body2">
                            {item.missing_percent.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
      
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>Candidate</TableCell>
              <TableCell>Match Score</TableCell>
              <TableCell>Skills</TableCell>
              <TableCell>Experience</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedResults.map((result) => {
              const candidateData = candidateDetails[result.resume_id];
              const isLoading = loadingCandidates[result.resume_id];
              
              return (
                <TableRow key={result.resume_id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2 }}>
                        {(candidateData?.name || 'A')[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {candidateData?.name || 'Loading...'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {candidateData?.email || result.resume_id}
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
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={result.score} 
                          color={result.score > 80 ? "success" : result.score > 60 ? "primary" : "warning"} 
                          sx={{ height: 8, borderRadius: 5 }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {result.score.toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {result.matching_skills && result.matching_skills.slice(0, 3).map((skill, index) => (
                        <Chip 
                          key={index} 
                          label={skill} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                      {result.missing_skills && result.missing_skills.slice(0, 2).map((skill, index) => (
                        <Chip 
                          key={`missing-${index}`} 
                          label={skill} 
                          size="small" 
                          color="error"
                          variant="outlined"
                        />
                      ))}
                      {((result.matching_skills && result.matching_skills.length > 3) || 
                       (result.missing_skills && result.missing_skills.length > 2)) && (
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
                    {result.experience ? `${result.experience} years` : 'N/A'}
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
                      <IconButton size="small">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Contact Candidate">
                      <IconButton size="small">
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
      
      {/* Resume Viewer Dialog */}
      <ResumeViewer 
        resumeId={selectedResumeId} 
        open={viewerOpen} 
        onClose={() => setViewerOpen(false)} 
      />
    </Box>
  );
};

export default ResultsDisplay; 