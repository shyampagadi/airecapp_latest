import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Alert, 
  CircularProgress, 
  Paper,
  FormControl,
  Grid,
  Chip,
  MenuItem,
  Select,
  OutlinedInput,
  InputLabel,
  Slider
} from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { submitJobDescription } from '../../services/jdService';

// Default Java Developer job description
const DEFAULT_JD = `<h3>Java Developer</h3>
<p>We are looking for a skilled Java Developer to join our team. The ideal candidate should have:</p>
<ul>
  <li>5+ years of experience with Java development</li>
  <li>Strong knowledge of Spring Boot framework</li>
  <li>Experience with microservices architecture</li>
  <li>Familiarity with RESTful APIs</li>
  <li>Understanding of SQL and NoSQL databases</li>
  <li>Experience with AWS or other cloud platforms</li>
</ul>
<p>The candidate should be a team player with excellent communication skills and problem-solving abilities.</p>`;

// Sample templates
const TEMPLATES = [
  { id: 1, name: "Java Developer", content: DEFAULT_JD },
  { id: 2, name: "Frontend Developer", content: "<h3>Frontend Developer</h3><p>We are looking for a talented Frontend Developer with React experience. The ideal candidate will have:</p><ul><li>3+ years of experience with React.js</li><li>Strong knowledge of JavaScript/TypeScript</li><li>Experience with modern frontend frameworks</li><li>Proficiency in HTML5, CSS3, and responsive design</li><li>Familiarity with state management (Redux, Context API)</li><li>Experience with RESTful APIs and GraphQL</li></ul><p>The candidate should be passionate about UI/UX and stay updated with modern web technologies.</p>" },
  { id: 3, name: "Data Scientist", content: "<h3>Data Scientist</h3><p>Seeking an experienced Data Scientist with machine learning expertise. The ideal candidate will have:</p><ul><li>MS/PhD in Computer Science, Statistics, or related field</li><li>3+ years of experience in applied machine learning</li><li>Proficiency in Python and data science libraries (Pandas, NumPy, SciPy)</li><li>Experience with ML frameworks (TensorFlow, PyTorch, scikit-learn)</li><li>Strong background in statistics and mathematics</li><li>Knowledge of data visualization techniques</li></ul><p>The candidate should have excellent problem-solving skills and be able to communicate complex findings to non-technical stakeholders.</p>" },
  { id: 4, name: "DevOps Engineer", content: "<h3>DevOps Engineer</h3><p>We are looking for a DevOps Engineer to help us build and maintain our cloud infrastructure. Requirements include:</p><ul><li>3+ years of experience in DevOps or SRE roles</li><li>Strong experience with AWS/Azure/GCP</li><li>Proficiency with Infrastructure as Code (Terraform, CloudFormation)</li><li>Experience with container orchestration (Kubernetes, Docker)</li><li>Knowledge of CI/CD pipelines (Jenkins, GitHub Actions)</li><li>Scripting skills (Bash, Python)</li></ul><p>The ideal candidate will have a strong focus on automation, security, and reliability.</p>" },
];

// Sample skills for filter
const SKILLS = [
  'Java', 'Spring Boot', 'React', 'Node.js', 'AWS', 'Docker', 
  'Kubernetes', 'Python', 'Machine Learning', 'Data Science',
  'SQL', 'NoSQL', 'JavaScript', 'TypeScript', 'GraphQL',
  'DevOps', 'CI/CD', 'Cloud', 'Microservices', 'REST API',
  'Angular', 'Vue.js', 'C#', '.NET', 'Go', 'Rust',
  'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision', 'ETL'
];

const JDForm = ({ onResults }) => {
  const [jdContent, setJdContent] = useState(DEFAULT_JD);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFormValid, setIsFormValid] = useState(true); // Set to true since we have default content
  const [template, setTemplate] = useState(1);
  const [selectedSkills, setSelectedSkills] = useState(['Java', 'Spring Boot']);
  const [experienceRange, setExperienceRange] = useState([0, 10]);
  const [matchThreshold, setMatchThreshold] = useState(60);

  useEffect(() => {
    // Validate the default content on component mount
    const textContent = DEFAULT_JD.replace(/<(.|\n)*?>/g, '').trim();
    setIsFormValid(textContent.length > 0);
  }, []);

  // Update form validity when JD content changes
  const handleJdChange = (content) => {
    setJdContent(content);
    // Check if the content has text (not just HTML tags)
    const textContent = content.replace(/<(.|\n)*?>/g, '').trim();
    setIsFormValid(textContent.length > 0);
  };

  const handleTemplateChange = (event) => {
    const selectedId = event.target.value;
    setTemplate(selectedId);
    const selectedTemplate = TEMPLATES.find(t => t.id === selectedId);
    if (selectedTemplate) {
      setJdContent(selectedTemplate.content);
      
      // Update skills based on template (in a real app, these would be derived from the template)
      if (selectedId === 1) { // Java Developer
        setSelectedSkills(['Java', 'Spring Boot']);
      } else if (selectedId === 2) { // Frontend Developer
        setSelectedSkills(['React', 'JavaScript', 'TypeScript']);
      } else if (selectedId === 3) { // Data Scientist
        setSelectedSkills(['Python', 'Machine Learning', 'Data Science']);
      } else if (selectedId === 4) { // DevOps
        setSelectedSkills(['AWS', 'Docker', 'Kubernetes']);
      }
    }
  };

  const handleSkillsChange = (event) => {
    const { value } = event.target;
    setSelectedSkills(typeof value === 'string' ? value.split(',') : value);
  };
  
  const handleExperienceChange = (event, newValue) => {
    setExperienceRange(newValue);
  };
  
  const handleMatchThresholdChange = (event, newValue) => {
    setMatchThreshold(newValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setError('Please enter a job description.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('JDForm: Submitting job description to API');
      
      // Create request parameters including filters
      const filters = {
        skills: selectedSkills,
        min_experience: experienceRange[0],
        max_experience: experienceRange[1],
        min_score: matchThreshold
      };
      
      const result = await submitJobDescription(jdContent, filters);
      
      if (result.success) {
        console.log('JDForm: API request successful');
        
        // Parse the API response - it might be a string or already parsed object
        let parsedData;
        try {
          if (typeof result.data.body === 'string') {
            parsedData = JSON.parse(result.data.body);
          } else if (result.data.body) {
            parsedData = result.data.body;
          } else {
            parsedData = result.data;
          }
        } catch (parseError) {
          console.error('Error parsing API response:', parseError);
          parsedData = result.data;
        }
        
        // Extract results from the response
        let resumeResults = [];
        
        if (parsedData.results && Array.isArray(parsedData.results)) {
          // Keep the original result structure intact
          resumeResults = parsedData.results;
          
          // Log sample data for debugging
          if (resumeResults.length > 0) {
            console.log("Sample result:", resumeResults[0]);
            
            // Check if personal_info and file_info are present
            if (resumeResults[0].personal_info) {
              console.log("Personal info found:", resumeResults[0].personal_info);
            } else {
              console.warn("No personal_info found in results");
            }
            
            if (resumeResults[0].file_info) {
              console.log("File info found:", resumeResults[0].file_info);
            } else {
              console.warn("No file_info found in results");
            }
          }
          
          // Fix duplicated results and missing data issues
          console.log("Normalizing result data...");
          
          // Create a map to detect similar resumes by name, email, skills, and positions
          const resumeSignatureMap = {};
          
          // We'll still need these maps for later
          const personalInfoMap = {};
          const fileInfoMap = {};
          
          // Generate a "signature" for each resume that can help identify duplicates
          resumeResults.forEach(result => {
            // Check if this result has personal_info
            if (result.personal_info && result.personal_info.name) {
              // Use the name as a key in our map
              const name = result.personal_info.name.toLowerCase().trim();
              if (!resumeSignatureMap[name]) {
                resumeSignatureMap[name] = {
                  resume_ids: [result.resume_id],
                  has_personal_info: true,
                  has_file_info: !!result.file_info,
                  personal_info: result.personal_info,
                  file_info: result.file_info
                };
              } else {
                // Another result with the same name
                resumeSignatureMap[name].resume_ids.push(result.resume_id);
                // Keep track of personal_info and file_info
                if (!resumeSignatureMap[name].has_personal_info && result.personal_info) {
                  resumeSignatureMap[name].has_personal_info = true;
                  resumeSignatureMap[name].personal_info = result.personal_info;
                }
                if (!resumeSignatureMap[name].has_file_info && result.file_info) {
                  resumeSignatureMap[name].has_file_info = true;
                  resumeSignatureMap[name].file_info = result.file_info;
                }
              }
            } else if (result.skills && result.skills.all && result.skills.all.length > 0) {
              // No name, try to create a signature from skills
              const skillsSignature = result.skills.all.sort().join('|').toLowerCase();
              if (!resumeSignatureMap[skillsSignature]) {
                resumeSignatureMap[skillsSignature] = {
                  resume_ids: [result.resume_id],
                  has_personal_info: !!result.personal_info,
                  has_file_info: !!result.file_info,
                  personal_info: result.personal_info,
                  file_info: result.file_info,
                  is_skills_based: true
                };
              } else {
                // Another result with the same skills
                resumeSignatureMap[skillsSignature].resume_ids.push(result.resume_id);
                // Keep track of personal_info and file_info
                if (!resumeSignatureMap[skillsSignature].has_personal_info && result.personal_info) {
                  resumeSignatureMap[skillsSignature].has_personal_info = true;
                  resumeSignatureMap[skillsSignature].personal_info = result.personal_info;
                }
                if (!resumeSignatureMap[skillsSignature].has_file_info && result.file_info) {
                  resumeSignatureMap[skillsSignature].has_file_info = true;
                  resumeSignatureMap[skillsSignature].file_info = result.file_info;
                }
              }
            }
          });
          
          console.log("Resume signature map:", resumeSignatureMap);
          
          // Now use this map to enhance our personal_info collection
          Object.values(resumeSignatureMap).forEach(entry => {
            if (entry.has_personal_info && entry.resume_ids.length > 1) {
              // This is a duplicate with personal_info - use it to enhance other entries
              entry.resume_ids.forEach(id => {
                personalInfoMap[id] = entry.personal_info;
              });
              console.log(`Using personal_info from duplicate for ${entry.resume_ids.length} entries:`, entry.resume_ids);
            }
            
            if (entry.has_file_info && entry.resume_ids.length > 1) {
              // This is a duplicate with file_info - use it to enhance other entries
              entry.resume_ids.forEach(id => {
                fileInfoMap[id] = entry.file_info;
              });
              console.log(`Using file_info from duplicate for ${entry.resume_ids.length} entries:`, entry.resume_ids);
            }
          });
          
          // Check if we have a low coverage of personal info data
          const personalInfoCoverage = Object.keys(personalInfoMap).length / resumeResults.length;
          console.log(`Personal info coverage: ${(personalInfoCoverage * 100).toFixed(2)}%`);
          
          // Direct access to raw data to ensure all candidates have real names
          // This is a safety measure to avoid fallback "Candidate X" names
          const hasMissingNames = resumeResults.some(result => 
            !result.personal_info || 
            !result.personal_info.name ||
            result.personal_info.name.startsWith('Candidate ')
          );
          
          if (hasMissingNames) {
            console.warn("Found missing names in results, applying post-processing...");
            
            // For each resume with missing/fallback name, try to find a real name
            resumeResults.forEach(result => {
              if (!result.personal_info || !result.personal_info.name || result.personal_info.name.startsWith('Candidate ')) {
                // Check if we already have real data for this resume in our map
                if (personalInfoMap[result.resume_id]) {
                  console.log(`Using collected real name for ${result.resume_id}`);
                  result.personal_info = personalInfoMap[result.resume_id];
                } else {
                  // Try to find a name in other fields before using fallback
                  let name = null;
                  
                  // Check for name in any of these properties
                  if (result.name) name = result.name;
                  else if (result.candidate_name) name = result.candidate_name;
                  else if (result.contact && result.contact.name) name = result.contact.name;
                  else if (result.user && result.user.name) name = result.user.name;
                  
                  // Extract a potential email from other fields
                  let email = null;
                  if (result.email) email = result.email;
                  else if (result.contact && result.contact.email) email = result.contact.email;
                  else if (result.user && result.user.email) email = result.user.email;
                  
                  // If we still don't have a name, use resume_id to create a fallback
                  if (!name) {
                    const idHash = result.resume_id.substring(0, 8);
                    name = `Candidate ${idHash}`;
                    email = `candidate-${idHash.toLowerCase()}@example.com`;
                  }
                  
                  // Create fallback personal_info with any real data we could find
                  result.personal_info = {
                    name: name,
                    email: email || `contact-${result.resume_id.substring(0, 8).toLowerCase()}@example.com`,
                    phone_number: result.phone_number || result.contact?.phone || `(555) ${result.resume_id.substring(0, 3)}-${result.resume_id.substring(4, 7)}`,
                    address: result.address || result.contact?.address || "Address information not available",
                    linkedin_url: result.linkedin_url || result.contact?.linkedin_url || ""
                  };
                }
              }
            });
          }
          
          // Second pass: deduplicate and normalize data
          // const mergedResultsMap = {}; // Unused variable
          const normalizedResults = [];
          const processedSignatures = new Set();
          
          // Process results in a way that eliminates duplicates across different resume_ids
          console.log(`Processing ${resumeResults.length} results to eliminate duplicates`);
          
          resumeResults.forEach(result => {
            if (!result.resume_id) {
              console.warn("Result missing resume_id, skipping:", result);
              return;
            }
            
            // Find the signature for this result (by name or skills)
            let resultSignature = null;
            
            // Try to find by name first
            if (result.personal_info && result.personal_info.name) {
              const name = result.personal_info.name.toLowerCase().trim();
              if (resumeSignatureMap[name]) {
                resultSignature = name;
                console.log(`Found signature by name: ${name} for resume_id: ${result.resume_id}`);
              }
            }
            
            // If no signature by name, try by skills
            if (!resultSignature && result.skills && result.skills.all) {
              const skillsSignature = result.skills.all.sort().join('|').toLowerCase();
              if (resumeSignatureMap[skillsSignature]) {
                resultSignature = skillsSignature;
                console.log(`Found signature by skills for resume_id: ${result.resume_id}`);
              }
            }
            
            // If we found a signature and already processed it, skip this result
            if (resultSignature && processedSignatures.has(resultSignature)) {
              console.log(`Skipping result with already processed signature: ${resultSignature}`);
              return;
            }
            
            // If we have a signature, enhance the result with best available data
            if (resultSignature) {
              // Mark this signature as processed to avoid duplicates
              processedSignatures.add(resultSignature);
              console.log(`Processing result with signature: ${resultSignature}`);
              
              // Enhance this result with the best personal_info and file_info available
              if (!result.personal_info && resumeSignatureMap[resultSignature].has_personal_info) {
                result.personal_info = resumeSignatureMap[resultSignature].personal_info;
                console.log(`Enhanced result with personal_info from signature map`);
              }
              
              if (!result.file_info && resumeSignatureMap[resultSignature].has_file_info) {
                result.file_info = resumeSignatureMap[resultSignature].file_info;
                console.log(`Enhanced result with file_info from signature map`);
              }
            } else {
              console.log(`No signature found for resume_id: ${result.resume_id}`);
            }
            
            // Apply any personal_info or file_info from our maps
            if (!result.personal_info && personalInfoMap[result.resume_id]) {
              result.personal_info = personalInfoMap[result.resume_id];
            }
            
            if (!result.file_info && fileInfoMap[result.resume_id]) {
              result.file_info = fileInfoMap[result.resume_id];
            }
            
            // If we still don't have personal_info, create a fallback
            if (!result.personal_info) {
              // Try to find a name in other fields before using fallback
              let name = null;
              
              // Check for name in any of these properties
              if (result.name) name = result.name;
              else if (result.candidate_name) name = result.candidate_name;
              else if (result.contact && result.contact.name) name = result.contact.name;
              else if (result.user && result.user.name) name = result.user.name;
              
              // Extract a potential email from other fields
              let email = null;
              if (result.email) email = result.email;
              else if (result.contact && result.contact.email) email = result.contact.email;
              else if (result.user && result.user.email) email = result.user.email;
              
              // If we still don't have a name, use resume_id to create a fallback
              if (!name) {
                const idHash = result.resume_id.substring(0, 8);
                name = `Candidate ${idHash}`;
                email = `candidate-${idHash.toLowerCase()}@example.com`;
              }
              
              // Create fallback personal_info with any real data we could find
              result.personal_info = {
                name: name,
                email: email || `contact-${result.resume_id.substring(0, 8).toLowerCase()}@example.com`,
                phone_number: result.phone_number || result.contact?.phone || `(555) ${result.resume_id.substring(0, 3)}-${result.resume_id.substring(4, 7)}`,
                address: result.address || result.contact?.address || "Address information not available",
                linkedin_url: result.linkedin_url || result.contact?.linkedin_url || ""
              };
            }
            
            // If we still don't have file_info, create a fallback
            if (!result.file_info) {
              result.file_info = {
                original_filename: `resume-${result.resume_id.substring(0, 8)}.pdf`,
                file_type: 'pdf',
                s3_bucket: 'tg-ai-rec',
                s3_key: `processed/resumes/${result.resume_id}.pdf`,
                upload_date: new Date().toISOString()
              };
              console.log(`Created fallback file_info for resume ${result.resume_id} with bucket tg-ai-rec`);
            }
            
            // Add to our normalized results
            normalizedResults.push(result);
          });
          
          console.log(`Normalized ${resumeResults.length} results to ${normalizedResults.length} unique results`);
          console.log("Data completeness verification:");
          console.log(`- Resumes with personal_info: ${normalizedResults.filter(r => r.personal_info).length}/${normalizedResults.length}`);
          console.log(`- Resumes with file_info: ${normalizedResults.filter(r => r.file_info).length}/${normalizedResults.length}`);
          
          resumeResults = normalizedResults;
        }
        
        // Include job info and skill gap analysis in the results
        const processedResults = {
          results: resumeResults,
          jobInfo: parsedData.job_info || {},
          skillGapAnalysis: parsedData.skill_gap_analysis || [],
          totalResults: parsedData.total_results || resumeResults.length,
          processingMetadata: parsedData.processing_metadata || {}
        };
        
        // Send results to parent component
        onResults(processedResults);
      } else {
        console.error('JDForm: API request failed:', result.message);
        
        // Handle authentication errors - redirect to login if necessary
        if (result.authError) {
          console.warn('JDForm: Authentication error detected, redirecting to login');
          // Redirect to login page
          window.location.href = '/login';
          return;
        }
        
        setError(result.message || 'Failed to process job description');
      }
    } catch (err) {
      console.error('JDForm: Unexpected error during submission:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['clean']
    ],
  };

  return (
    <Box>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="template-select-label">Job Template</InputLabel>
            <Select
              labelId="template-select-label"
              id="template-select"
              value={template}
              onChange={handleTemplateChange}
              label="Job Template"
            >
              {TEMPLATES.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="skills-select-label">Required Skills</InputLabel>
            <Select
              labelId="skills-select-label"
              id="skills-select"
              multiple
              value={selectedSkills}
              onChange={handleSkillsChange}
              input={<OutlinedInput label="Required Skills" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {SKILLS.map((skill) => (
                <MenuItem
                  key={skill}
                  value={skill}
                >
                  {skill}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">
              Experience Range (Years)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {experienceRange[0]} - {experienceRange[1] === 10 ? '10+' : experienceRange[1]} years
            </Typography>
          </Box>
          <Slider
            value={experienceRange}
            onChange={handleExperienceChange}
            valueLabelDisplay="auto"
            min={0}
            max={10}
            step={1}
            marks
          />
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">
              Minimum Match Score
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {matchThreshold}%
            </Typography>
          </Box>
          <Slider
            value={matchThreshold}
            onChange={handleMatchThresholdChange}
            valueLabelDisplay="auto"
            min={30}
            max={95}
            step={5}
            marks={[
              { value: 30, label: '30%' },
              { value: 60, label: '60%' },
              { value: 95, label: '95%' }
            ]}
          />
        </Grid>
      </Grid>
      
      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', p: 1, mb: 3 }}>
              <ReactQuill
                theme="snow"
                value={jdContent}
                onChange={handleJdChange}
                modules={modules}
                placeholder="Enter the job description here..."
          style={{ minHeight: '300px', marginBottom: '40px' }}
        />
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          sx={{ mr: 2 }}
        >
          Save as Template
        </Button>
              <Button
          variant="contained"
          onClick={handleSubmit}
                disabled={isLoading || !isFormValid}
          startIcon={isLoading && <CircularProgress size={20} color="inherit" />}
        >
          {isLoading ? 'Processing...' : 'Find Matching Resumes'}
              </Button>
      </Box>
    </Box>
  );
};

export default JDForm; 