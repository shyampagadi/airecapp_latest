import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box, 
  Divider, 
  CircularProgress,
  Paper,
  IconButton
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Recommend as RecommendIcon
} from '@mui/icons-material';

// Simple mock analysis component - no external API calls
const CandidateAnalysisModal = ({ open, onClose, candidateData, jobInfo }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  // Generate analysis based on candidate data
  useEffect(() => {
    if (open && candidateData) {
      // Show loading indicator
      setLoading(true);
      setError(null);
      
      // Wait 1.5 seconds to simulate API call
      const timer = setTimeout(() => {
        try {
          // Generate mock analysis
          console.log("Analyzing candidate:", candidateData);
          
          // Make sure skills data is properly formatted
          const skills = candidateData.skills || {};
          const matchingSkills = Array.isArray(skills.matching) ? skills.matching : [];
          const missingSkills = Array.isArray(skills.missing) ? skills.missing : [];
          
          // Generate mock analysis text
          const mockText = generateMockAnalysis(
            candidateData.personal_info?.name || "Candidate",
            candidateData.positions?.[0] || "Professional",
            candidateData.experience?.years || 0,
            matchingSkills,
            missingSkills,
            candidateData.scores || {},
            jobInfo || {}
          );
          
          // Structure the analysis into sections
          setAnalysis({
            rawText: mockText,
            sections: {
              executiveSummary: extractSection(mockText, "EXECUTIVE SUMMARY", "SCORE ANALYSIS"),
              scoreAnalysis: extractSection(mockText, "SCORE ANALYSIS", "KEY STRENGTHS"),
              keyStrengths: extractSection(mockText, "KEY STRENGTHS", "AREAS FOR CONSIDERATION"),
              areasForConsideration: extractSection(mockText, "AREAS FOR CONSIDERATION", "INTERVIEW RECOMMENDATIONS"),
              interviewRecommendations: extractSection(mockText, "INTERVIEW RECOMMENDATIONS", "FINAL RECOMMENDATION"),
              finalRecommendation: extractSection(mockText, "FINAL RECOMMENDATION", null)
            }
          });
          
          setLoading(false);
        } catch (err) {
          console.error("Error generating analysis:", err);
          setError("Failed to generate analysis. Please try again.");
          setLoading(false);
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
    
    // Reset when dialog is closed
    if (!open) {
      setAnalysis(null);
    }
  }, [open, candidateData, jobInfo]);

  // Extract a section from text based on section markers
  const extractSection = (text, startMarker, endMarker) => {
    const startIndex = text.indexOf(startMarker);
    if (startIndex === -1) return '';
    
    const startWithoutMarker = startIndex + startMarker.length;
    const endIndex = endMarker ? text.indexOf(endMarker, startWithoutMarker) : text.length;
    if (endIndex === -1) return text.substring(startWithoutMarker).trim();
    
    return text.substring(startWithoutMarker, endIndex).trim();
  };

  // Convert bullet points to array elements
  const formatBulletPoints = (text) => {
    if (!text) return [];
    
    // Split by bullet points, numbers, or dashes
    const bulletRegex = /(?:^|\n)[-•*]|\d+\.\s*/g;
    const points = text.split(bulletRegex).filter(p => p.trim().length > 0);
    
    return points;
  };

  // Generate mock analysis text
  const generateMockAnalysis = (name, position, experience, matchingSkills, missingSkills, scores, job) => {
    const overallScore = scores.overall || 50;
    const skillScore = scores.skill_coverage || 40;
    const expScore = scores.experience_match || 60;
    const jobTitle = job.job_title || "the position";
    const reqExp = job.required_experience || "not specified";
    
    return `
EXECUTIVE SUMMARY
${name} has ${experience} years of experience as a ${position}, with an overall match score of ${overallScore}% for ${jobTitle}. ${overallScore > 70 ? 'The candidate demonstrates strong alignment with the job requirements.' : overallScore > 50 ? 'The candidate shows moderate alignment with the position requirements.' : 'The candidate meets some of the basic requirements for the position.'}

SCORE ANALYSIS
The overall match score of ${overallScore}% is based on skill alignment (${skillScore}%) and experience match (${expScore}%). ${matchingSkills.length > 0 ? `The candidate possesses ${matchingSkills.length} matching skills including ${matchingSkills.slice(0, 3).join(", ")}${matchingSkills.length > 3 ? ' and others' : ''}.` : 'The candidate has no directly matching skills for this position.'} ${missingSkills.length > 0 ? `There are ${missingSkills.length} missing skills: ${missingSkills.slice(0, 3).join(", ")}${missingSkills.length > 3 ? ' and others' : ''}.` : 'The candidate has all the required skills for this position.'} Experience score is based on ${experience} years of professional experience compared to the required ${reqExp} years.

KEY STRENGTHS
* ${matchingSkills.length > 0 ? `Proficiency in ${matchingSkills[0]}${matchingSkills.length > 1 ? ` and ${matchingSkills.length - 1} other matching skills` : ''}` : 'Has professional experience'}
* ${experience > 5 ? `Extensive industry experience with ${experience} years in the field` : `${experience} years of relevant professional experience`}
* Strong background in ${position} role
* ${matchingSkills.length > 2 ? `Technical diversity spanning ${matchingSkills.slice(0, 3).join(", ")}` : 'Professional skills applicable to the position'}
* ${overallScore > 70 ? 'Excellent overall match for position requirements' : 'Shows potential for growth in the role'}

AREAS FOR CONSIDERATION
* ${missingSkills.length > 0 ? `Lacks experience in ${missingSkills.slice(0, 2).join(" and ")}` : 'May need training in company-specific technologies'}
* ${experience < reqExp ? `Has ${experience} years of experience, which is less than the required ${reqExp} years` : 'May need to adapt to company-specific practices and methodologies'}

INTERVIEW RECOMMENDATIONS
* Explore their experience with ${matchingSkills.length > 0 ? matchingSkills[0] : 'relevant technologies'} and approach to problem-solving
* Assess their adaptability and willingness to learn ${missingSkills.length > 0 ? missingSkills[0] : 'new technologies'}
* Evaluate cultural fit and alignment with team dynamics and company values

FINAL RECOMMENDATION
Based on the candidate's profile, they appear to be a ${overallScore > 70 ? 'strong' : overallScore > 50 ? 'moderate' : 'potential'} match for the ${jobTitle} position. ${overallScore > 70 ? 'Recommend proceeding with the interview process.' : overallScore > 50 ? 'Suggest conducting a technical screening to verify skills.' : 'Consider interviewing if stronger candidates are not available.'}
`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            AI Candidate Analysis
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center" sx={{ my: 2 }}>
            {error}
          </Typography>
        ) : analysis ? (
          <Box sx={{ p: 0 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6">Executive Summary</Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>{analysis.sections.executiveSummary}</Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6">Score Analysis</Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>{analysis.sections.scoreAnalysis}</Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                Key Strengths
              </Typography>
              <Box sx={{ mt: 1 }}>
                {formatBulletPoints(analysis.sections.keyStrengths).map((point, index) => (
                  <Box key={index} sx={{ display: 'flex', mb: 1 }}>
                    <Typography variant="body1" component="div">
                      <Box component="span" sx={{ mr: 1 }}>•</Box>
                      {point.trim()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon color="warning" sx={{ mr: 1 }} />
                Areas for Consideration
              </Typography>
              <Box sx={{ mt: 1 }}>
                {formatBulletPoints(analysis.sections.areasForConsideration).map((point, index) => (
                  <Box key={index} sx={{ display: 'flex', mb: 1 }}>
                    <Typography variant="body1" component="div">
                      <Box component="span" sx={{ mr: 1 }}>•</Box>
                      {point.trim()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <QuestionAnswerIcon color="info" sx={{ mr: 1 }} />
                Interview Recommendations
              </Typography>
              <Box sx={{ mt: 1 }}>
                {formatBulletPoints(analysis.sections.interviewRecommendations).map((point, index) => (
                  <Box key={index} sx={{ display: 'flex', mb: 1 }}>
                    <Typography variant="body1" component="div">
                      <Box component="span" sx={{ mr: 1 }}>•</Box>
                      {point.trim()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Paper 
              elevation={3} 
              sx={{ 
                p: 2, 
                backgroundColor: 'primary.light', 
                color: 'primary.contrastText' 
              }}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <RecommendIcon sx={{ mr: 1 }} />
                Final Recommendation
              </Typography>
              <Typography variant="body1">{analysis.sections.finalRecommendation}</Typography>
            </Paper>
          </Box>
        ) : null}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {analysis && (
          <Button 
            variant="contained" 
            onClick={() => navigator.clipboard.writeText(analysis.rawText)}
          >
            Copy Analysis
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CandidateAnalysisModal; 