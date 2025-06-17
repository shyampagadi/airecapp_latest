import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Card, 
  CardContent, 
  CardActions,
  Divider
} from '@mui/material';
import SimpleLangchainAnalysis from './SimpleLangchainAnalysis';

/**
 * Example component showing how to use LangChain with AWS Bedrock
 * for candidate analysis
 */
const LangchainBedrockExample = () => {
  // Sample candidate data
  const sampleCandidate = {
    personal_info: {
      name: "Alex Johnson",
      email: "alex@example.com"
    },
    skills: {
      matching: ["JavaScript", "React", "Node.js"],
      missing: ["AWS", "GraphQL"],
      all: ["JavaScript", "React", "Node.js", "HTML", "CSS", "MongoDB"]
    },
    experience: {
      years: 4,
      required: 5,
      difference: -1
    },
    positions: ["Senior Frontend Developer", "Web Developer"],
    education: [
      {
        degree: "Bachelor of Science in Computer Science",
        institution: "University of Technology",
        year: "2019"
      }
    ],
    scores: {
      overall: 85,
      skill_match: 70,
      experience_match: 80
    }
  };

  // Sample job data
  const sampleJob = {
    job_title: "Senior Frontend Developer",
    required_skills: ["JavaScript", "React", "AWS", "GraphQL", "Node.js"],
    required_experience: 5
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        LangChain + AWS Bedrock Example
      </Typography>
      
      <Typography variant="body1" paragraph>
        This example demonstrates how to use LangChain with AWS Bedrock directly in a React application,
        without needing a Lambda function or separate API.
      </Typography>
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Sample Candidate Data
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="subtitle1">
              {sampleCandidate.personal_info.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Experience: {sampleCandidate.experience.years} years
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Skills: {sampleCandidate.skills.all.join(', ')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Education: {sampleCandidate.education[0].degree} from {sampleCandidate.education[0].institution}
            </Typography>
          </CardContent>
        </Card>
      </Box>
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Sample Job Requirements
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="subtitle1">
              {sampleJob.job_title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Required Skills: {sampleJob.required_skills.join(', ')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Required Experience: {sampleJob.required_experience} years
            </Typography>
          </CardContent>
        </Card>
      </Box>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          LangChain Analysis
        </Typography>
        
        <SimpleLangchainAnalysis 
          candidate={sampleCandidate} 
          jobInfo={sampleJob} 
        />
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Note: This component uses LangChain.js with AWS Bedrock directly in the browser.
            Make sure your AWS Cognito setup has the proper permissions for Bedrock access.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default LangchainBedrockExample; 