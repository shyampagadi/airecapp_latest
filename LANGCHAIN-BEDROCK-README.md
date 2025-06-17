# LangChain with AWS Bedrock Integration

This document explains how to use LangChain.js to integrate AWS Bedrock directly in your React application without requiring a Lambda function or a separate API.

## Overview

The implementation uses:
- LangChain.js libraries to create LLM chains directly in the browser
- AWS Bedrock models accessed via AWS credentials from Amplify Auth
- React components that directly call Bedrock models

## Prerequisites

1. AWS Account with access to AWS Bedrock models
2. AWS Cognito setup with appropriate IAM permissions
3. AWS Amplify for authentication and credentials management

## IAM Policy Requirements

Add the following IAM policy to your authenticated user role in Cognito:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*:*:model/meta.llama3-*",
        "arn:aws:bedrock:*:*:model/anthropic.claude-*",
        "arn:aws:bedrock:*:*:model/amazon.titan-*"
      ]
    }
  ]
}
```

## Installation

1. Install required dependencies:

```bash
npm install langchain @langchain/core @langchain/community aws-amplify
```

2. Configure environment variables in your `.env` file:

```
REACT_APP_AWS_REGION=us-east-1
REACT_APP_BEDROCK_DEFAULT_MODEL=meta.llama3-70b-instruct-v1:0
REACT_APP_BEDROCK_IDENTITY_POOL_ID=us-east-1:00000000-0000-0000-0000-000000000000
```

3. Ensure AWS Amplify is properly configured in your React application with Cognito authentication.

## How It Works

The implementation:

1. **Gets AWS Credentials**: Uses AWS Amplify to get temporary credentials for the authenticated user
2. **Creates LangChain Components**:
   - BedrockChat model instance
   - PromptTemplate for structured prompting
   - StringOutputParser to handle model outputs
   - RunnableSequence to chain these components
3. **Sends Requests**: Invokes the chain with input values from your UI
4. **Processes Responses**: Parses the model responses into structured data

## Code Example

```javascript
import { Auth } from 'aws-amplify';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';

async function analyzeWithBedrock(input) {
  // Get AWS credentials from Amplify Auth
  const credentials = await Auth.currentCredentials();
  
  // Create BedrockChat instance with the credentials
  const model = new BedrockChat({
    model: 'meta.llama3-70b-instruct-v1:0',
    region: process.env.REACT_APP_AWS_REGION,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    modelKwargs: {
      max_gen_len: 512,
      temperature: 0.5,
      top_p: 0.9
    }
  });

  // Create the prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
    You are an assistant helping with {task}.
    
    Input: {input}
    
    Please provide a detailed response:
  `);

  // Create the chain
  const chain = RunnableSequence.from([
    promptTemplate,
    model,
    new StringOutputParser()
  ]);
  
  // Invoke the chain with input values
  const response = await chain.invoke({
    task: "text analysis",
    input: input
  });
  
  return response;
}
```

## Advantages of Client-Side LangChain with Bedrock

1. **Simplified Architecture**: No need for Lambda functions or additional backend services
2. **Reduced Latency**: Direct calls to Bedrock from the client
3. **Cost Efficiency**: No additional AWS service costs beyond Bedrock usage
4. **Flexibility**: Easy to switch between models or adjust parameters on the client
5. **Improved Development Experience**: Faster iteration and testing cycles
6. **Security**: Uses temporary AWS credentials with limited permissions

## Model Support

The implementation supports all AWS Bedrock models, including:

- **Meta Llama 3**: Various sizes available
- **Anthropic Claude**: Claude 3 models
- **Amazon Titan**: Text models
- **Other models**: Can be easily configured

## Security Considerations

1. **IAM Permissions**: Make sure to restrict IAM permissions to only what's needed
2. **Credential Handling**: Never expose AWS credentials in client-side code
3. **Token Limits**: Set appropriate token limits to control costs
4. **Request Validation**: Validate user inputs before sending to models
5. **Response Filtering**: Consider filtering sensitive information from model responses

## Troubleshooting

1. **Access Denied Errors**: Check IAM permissions for Bedrock actions
2. **Model Not Found**: Verify model IDs and region configurations
3. **Credential Issues**: Make sure Amplify Auth is properly set up
4. **CORS Errors**: Check AWS CORS configuration if needed
5. **Rate Limits**: Handle rate limiting from Bedrock appropriately

## Further Enhancements

1. **Caching**: Implement client-side caching for responses
2. **Streaming**: Use streaming responses for better UX with longer outputs
3. **Retry Logic**: Add exponential backoff for transient failures
4. **Prompt Templates**: Create a library of reusable prompt templates
5. **Output Parsing**: Use structured output parsers for complex responses 