import { Auth } from 'aws-amplify';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import config from '../config';

/**
 * Example of using LangChain with AWS Bedrock
 * This is a minimal implementation that shows the core functionality
 */

// Function to get a BedrockChat model instance
export async function getBedrockModel(modelId = 'meta.llama3-70b-instruct-v1:0') {
  // Get AWS credentials from Amplify Auth
  const credentials = await Auth.currentCredentials();
  
  // Create BedrockChat instance with credentials from Amplify
  const model = new BedrockChat({
    model: modelId,
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    modelKwargs: {
      temperature: 0.5,
      top_p: 0.9
    }
  });
  
  return model;
}

// Function to analyze a candidate with Bedrock
export async function analyzeCandidate(candidate, jobInfo) {
  try {
    // Get the model
    const model = await getBedrockModel();
    
    // Create a simple prompt
    const prompt = `
      Analyze this candidate for the job:
      Candidate: ${JSON.stringify(candidate)}
      Job: ${JSON.stringify(jobInfo)}
      
      Give a detailed analysis.
    `;
    
    // Invoke the model
    const response = await model.invoke(prompt);
    
    return {
      success: true,
      result: response.content
    };
  } catch (error) {
    console.error('Error using Bedrock:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Example usage:
// 
// import { analyzeCandidate } from './bedrockLangchainExample';
//
// async function example() {
//   const candidate = { /* candidate data */ };
//   const jobInfo = { /* job data */ };
//   
//   const result = await analyzeCandidate(candidate, jobInfo);
//   console.log(result);
// } 