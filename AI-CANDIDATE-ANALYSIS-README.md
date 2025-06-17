# AI Candidate Analysis Feature

This feature allows recruiters to generate AI-powered analysis of candidate profiles directly from the search results. The analysis is performed using AWS Bedrock's meta.llama3-70b-instruct-v1 model.

## Implementation Overview

The feature consists of:

1. **Bedrock Service** (`src/services/bedrockService.js`) - Service that handles the integration with AWS Bedrock
2. **Analysis Modal** (`src/components/jd/CandidateAnalysisModal.js`) - UI component that displays the analysis results
3. **"Analyze Profile" button** - Added to each candidate row in the ResultsDisplay component

## Prerequisites

1. AWS account with Bedrock access enabled
2. IAM roles/users with appropriate permissions
3. AWS Amplify for authentication

## Installation

1. Install required dependencies:
   ```
   npm install @aws-sdk/client-bedrock-runtime
   ```

2. Make sure your IAM role/user has permissions to access AWS Bedrock
   - Add the `bedrock:InvokeModel` permission to your IAM policy
   - Example policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "bedrock:InvokeModel",
         "Resource": "arn:aws:bedrock:*:*:model/meta.llama3-70b-instruct-v1*"
       }
     ]
   }
   ```

3. Update your environment variables:
   ```
   REACT_APP_AWS_REGION=us-east-1
   REACT_APP_BEDROCK_MODEL_ID=meta.llama3-70b-instruct-v1:0
   ```

## Usage

1. Search for candidates using your job description
2. In the results list, click the "Analyze Profile" button (brain icon) next to any candidate
3. The analysis modal will open, showing:
   - Executive Summary
   - Score Analysis
   - Key Strengths
   - Areas for Consideration
   - Interview Recommendations
   - Final Recommendation

## How It Works

1. When a user clicks "Analyze Profile", the CandidateAnalysisModal component opens
2. The component calls bedrockService.analyzeCandidateProfile() with the candidate data
3. The service creates a structured prompt based on the candidate's skills, experience, etc.
4. The prompt is sent to AWS Bedrock using the AWS SDK
5. The response is parsed and displayed in the modal with appropriate formatting

## Troubleshooting

- **Error: "Access Denied"** - Check your IAM permissions, make sure your role/user has bedrock:InvokeModel permissions
- **Error: "Model not found"** - Verify the model ID is correct and that you have access to that specific model
- **Error: "Missing credentials"** - Ensure Amplify Auth is properly configured

## Customization

You can customize:
- The model used (change REACT_APP_BEDROCK_MODEL_ID)
- The prompt format in createAnalysisPrompt() in bedrockService.js
- The UI display in CandidateAnalysisModal.js 