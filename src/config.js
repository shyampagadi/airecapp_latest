// src/config.js
const awsConfig = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_IZ3y1LZks',
  userPoolWebClientId: '6sv5m49okk20nuqruk01dckvb5',
  oauth: {
    domain: 'us-east-1iz3y1lzks.auth.us-east-1.amazoncognito.com',
    scope: ['phone', 'email', 'profile', 'openid', 'aws.cognito.signin.user.admin'],
    redirectSignIn: window.location.origin,
    redirectSignOut: window.location.origin,
    responseType: 'code'
  }
};

export default awsConfig;

