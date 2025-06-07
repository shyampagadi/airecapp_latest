import { Auth } from 'aws-amplify';
import cognitoConfig from '../config';

// AWS Amplify configuration
const awsConfig = {
  Auth: {
    region: cognitoConfig.region,
    userPoolId: cognitoConfig.userPoolId,
    userPoolWebClientId: cognitoConfig.userPoolWebClientId,
    oauth: cognitoConfig.oauth,
    mandatorySignIn: true,
  },
  API: {
    endpoints: [
      {
        name: 'jdSearchApi',
        endpoint: process.env.REACT_APP_API_ENDPOINT,
        region: cognitoConfig.region,
        custom_header: async () => {
          return { Authorization: `Bearer ${(await Auth.currentSession()).getAccessToken().getJwtToken()}` }
        }
      },
    ]
  }
};

export default awsConfig; 