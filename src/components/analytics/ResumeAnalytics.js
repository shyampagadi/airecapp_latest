import React, { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Tabs, 
  Tab, 
  Divider,
  useTheme,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { 
  MoreVert as MoreVertIcon,
  GetApp as DownloadIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

// Sample data for charts
const skillsData = [
  { name: 'Java', value: 135 },
  { name: 'JavaScript', value: 120 },
  { name: 'Python', value: 98 },
  { name: 'AWS', value: 86 },
  { name: 'React', value: 72 },
  { name: 'Spring Boot', value: 65 },
];

const experienceData = [
  { name: '0-1 Years', value: 210 },
  { name: '1-3 Years', value: 320 },
  { name: '3-5 Years', value: 280 },
  { name: '5-7 Years', value: 190 },
  { name: '7+ Years', value: 120 },
];

const processingData = [
  { name: 'Jan', count: 45, time: 3.2 },
  { name: 'Feb', count: 52, time: 2.8 },
  { name: 'Mar', count: 48, time: 2.9 },
  { name: 'Apr', count: 70, time: 2.5 },
  { name: 'May', count: 95, time: 2.2 },
  { name: 'Jun', count: 120, time: 2.0 },
  { name: 'Jul', count: 110, time: 1.8 },
];

const sourceData = [
  { name: 'LinkedIn', value: 35 },
  { name: 'Indeed', value: 25 },
  { name: 'Company Website', value: 20 },
  { name: 'Referrals', value: 15 },
  { name: 'Other', value: 5 },
];

const ResumeAnalytics = () => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState('month');
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Resume Analytics Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 120, mr: 2 }} size="small">
            <InputLabel id="time-range-label">Time Range</InputLabel>
            <Select
              labelId="time-range-label"
              id="time-range-select"
              value={timeRange}
              label="Time Range"
              onChange={handleTimeRangeChange}
            >
              <MenuItem value="week">Last 7 Days</MenuItem>
              <MenuItem value="month">Last 30 Days</MenuItem>
              <MenuItem value="quarter">Last Quarter</MenuItem>
              <MenuItem value="year">Last Year</MenuItem>
            </Select>
          </FormControl>
          <Button 
            variant="outlined" 
            startIcon={<DownloadIcon />}
            size="small"
          >
            Export
          </Button>
        </Box>
      </Box>
      
      {/* Summary Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography color="text.secondary" variant="subtitle2">
                  Total Resumes
                </Typography>
                <IconButton size="small">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                1,534
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2" color="success.main">
                  +18.2%
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  vs. previous period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography color="text.secondary" variant="subtitle2">
                  Avg. Processing Time
                </Typography>
                <IconButton size="small">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                2.4s
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2" color="success.main">
                  -12.5%
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  vs. previous period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography color="text.secondary" variant="subtitle2">
                  Avg. Match Score
                </Typography>
                <IconButton size="small">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                76%
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2" color="success.main">
                  +5.3%
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  vs. previous period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography color="text.secondary" variant="subtitle2">
                  Success Rate
                </Typography>
                <IconButton size="small">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                99.8%
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2" color="success.main">
                  +0.2%
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  vs. previous period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Charts */}
      <Box sx={{ mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" />
          <Tab label="Skills Distribution" />
          <Tab label="Experience Levels" />
          <Tab label="Source Analysis" />
        </Tabs>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      {/* Tab panels */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Resume Processing Trends
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Number of resumes processed and average processing time
                </Typography>
                <Box sx={{ height: 350, mt: 3 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={processingData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="count" 
                        name="Resumes Processed"
                        stroke={theme.palette.primary.main} 
                        activeDot={{ r: 8 }} 
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="time" 
                        name="Avg. Processing Time (s)"
                        stroke={theme.palette.secondary.main} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} lg={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Resume Sources
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Distribution of resume sources
                </Typography>
                <Box sx={{ height: 350, mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Skills Distribution
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Most common skills found in resumes
            </Typography>
            <Box sx={{ height: 400, mt: 3 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={skillsData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Number of Resumes" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]}>
                    {skillsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}
      
      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Experience Levels
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Distribution of experience levels in resumes
            </Typography>
            <Box sx={{ height: 400, mt: 3 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={experienceData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Number of Candidates" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}
      
      {tabValue === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Source Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Detailed analysis of resume sources
            </Typography>
            <Box sx={{ height: 400, mt: 3, display: 'flex', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ResumeAnalytics; 