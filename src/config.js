// src/config.js
const config = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
  userPoolWebClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID || '',
  oauth: {
    domain: process.env.REACT_APP_OAUTH_DOMAIN || '',
    scope: ['email', 'profile', 'openid'],
    redirectSignIn: process.env.REACT_APP_REDIRECT_SIGN_IN || 'http://localhost:3000/',
    redirectSignOut: process.env.REACT_APP_REDIRECT_SIGN_OUT || 'http://localhost:3000/',
    responseType: 'code'
  },
  
  // Bedrock configuration
  bedrock: {
    region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
    defaultModelId: process.env.REACT_APP_BEDROCK_MODEL_ID || process.env.REACT_APP_BEDROCK_DEFAULT_MODEL || 'meta.llama3-70b-instruct-v1:0'
  }
};

export default config;

