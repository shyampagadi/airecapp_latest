import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/authService';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Container, 
  CircularProgress, 
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tabs,
  Tab,
  Stack,
  Chip,
  LinearProgress
} from '@mui/material';
import { 
  ArrowUpward, 
  ArrowDownward,
  GetApp as DownloadIcon,
  Email as EmailIcon,
  Visibility as ViewIcon,
  Check as CheckIcon,
  PeopleAlt as PeopleIcon,
  WorkOutline as WorkIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';

import JDForm from './JDForm';
import ResultsDisplay from './ResultsDisplay';
import ResumeAnalytics from '../analytics/ResumeAnalytics';
import ResumeViewer from '../resume/ResumeViewer';

const Dashboard = () => {
  const [results, setResults] = useState(null);
  const [jobInfo, setJobInfo] = useState(null);
  const [skillGapAnalysis, setSkillGapAnalysis] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mainTabValue, setMainTabValue] = useState(0);
  const [searchTabValue, setSearchTabValue] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        console.log('Dashboard: Checking authentication...');
        const result = await getCurrentUser();
        
        if (!result.success) {
          console.log('Dashboard: User not authenticated, redirecting to login');
          navigate('/login');
        } else {
          console.log('Dashboard: User authenticated');
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Dashboard: Error checking authentication:', error);
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [navigate]);

  const handleResults = (data) => {
    console.log('Dashboard: Received results from API', data);
    
    if (data.results) {
      setResults(data.results);
      setJobInfo(data.jobInfo);
      setSkillGapAnalysis(data.skillGapAnalysis);
    } else {
      // Handle legacy format
      setResults(data);
      setJobInfo(null);
      setSkillGapAnalysis([]);
    }
  };

  const handleMainTabChange = (event, newValue) => {
    setMainTabValue(newValue);
  };

  const handleSearchTabChange = (event, newValue) => {
    setSearchTabValue(newValue);
  };

  const handleViewResume = (resumeId) => {
    setSelectedResumeId(resumeId);
    setViewerOpen(true);
  };

  if (isLoading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>Loading dashboard...</Typography>
        </Box>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login via useEffect
  }

  return (
    <Container maxWidth="xl">
      {/* Main Dashboard Tabs */}
      <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={mainTabValue} 
          onChange={handleMainTabChange}
          aria-label="main dashboard tabs"
          sx={{ '& .MuiTab-root': { minHeight: 64 } }}
        >
          <Tab 
            icon={<SearchIcon />} 
            label="Resume Search" 
            iconPosition="start"
          />
          <Tab 
            icon={<BarChartIcon />} 
            label="Analytics Dashboard" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Resume Search Tab */}
      {mainTabValue === 0 && (
        <>
          {/* Summary Stats */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} md={6} lg={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography color="text.secondary" variant="subtitle2">
                      Current Vacancies
                    </Typography>
                    <Avatar sx={{ bgcolor: 'primary.light', width: 40, height: 40 }}>
                      <WorkIcon fontSize="small" />
                    </Avatar>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" mb={1}>
                    104
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography color="success.main" variant="body2" sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                      <ArrowUpward fontSize="small" /> 26%
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      from last month
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6} lg={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography color="text.secondary" variant="subtitle2">
                      Total Applicants
                    </Typography>
                    <Avatar sx={{ bgcolor: 'success.light', width: 40, height: 40 }}>
                      <PeopleIcon fontSize="small" />
                    </Avatar>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" mb={1}>
                    1,534
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography color="success.main" variant="body2" sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                      <ArrowUpward fontSize="small" /> 26%
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      from last month
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6} lg={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography color="text.secondary" variant="subtitle2">
                      Shortlisted
                    </Typography>
                    <Avatar sx={{ bgcolor: 'warning.light', width: 40, height: 40 }}>
                      <CheckIcon fontSize="small" />
                    </Avatar>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" mb={1}>
                    325
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography color="error.main" variant="body2" sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                      <ArrowDownward fontSize="small" /> 5%
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      from last month
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6} lg={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography color="text.secondary" variant="subtitle2">
                      Hired
                    </Typography>
                    <Avatar sx={{ bgcolor: 'info.light', width: 40, height: 40 }}>
                      <CheckCircleIcon fontSize="small" />
                    </Avatar>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" mb={1}>
                    58
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography color="success.main" variant="body2" sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                      <ArrowUpward fontSize="small" /> 12%
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      from last month
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Job Description Input Section */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    <Tabs value={searchTabValue} onChange={handleSearchTabChange} aria-label="search tabs">
                      <Tab label="Search by Job Description" />
                      <Tab label="Recent Searches" />
                      <Tab label="Saved Templates" />
                    </Tabs>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    {searchTabValue === 0 && (
                      <>
                        <Typography variant="h6" mb={2}>
                          Enter a job description to find matching resumes
                        </Typography>
                        <JDForm onResults={handleResults} />
                      </>
                    )}
                    {searchTabValue === 1 && (
                      <Typography variant="body1">Your recent searches will appear here.</Typography>
                    )}
                    {searchTabValue === 2 && (
                      <Typography variant="body1">Your saved templates will appear here.</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Results Section */}
            {results && (
              <Grid item xs={12}>
                <ResultsDisplay 
                  results={results} 
                  jobInfo={jobInfo}
                  skillGapAnalysis={skillGapAnalysis}
                  isLoading={false} 
                />
              </Grid>
            )}
          </Grid>
        </>
      )}

      {/* Analytics Dashboard Tab */}
      {mainTabValue === 1 && (
        <ResumeAnalytics />
      )}

      {/* Resume Viewer Dialog */}
      <ResumeViewer 
        resumeId={selectedResumeId} 
        open={viewerOpen} 
        onClose={() => setViewerOpen(false)} 
      />
    </Container>
  );
};

export default Dashboard; 