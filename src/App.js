import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';

// Components
import Header from './components/layout/Header';
import Login from './components/auth/Login';
import Dashboard from './components/jd/Dashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ApiTest from './ApiTest';
import LangchainBedrockExample from './components/jd/LangchainBedrockExample';
import BedrockApiTest from './components/jd/BedrockApiTest';

// Custom theme
import theme from './theme';

// AWS Configuration - direct import
import config from './config';

// Import API_GATEWAY config
import { API_GATEWAY } from './config/appConfig';

function App() {
  useEffect(() => {
    // Log the raw imported config
    console.log("Raw imported config:", config);
    
    // Hard-code the values for testing if needed
    const hardcodedConfig = {
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
    
    // Get API endpoints from config
    const jdSearchEndpoint = API_GATEWAY.jdSearchEndpoint;
    const bedrockAnalysisEndpoint = API_GATEWAY.bedrockAnalysisEndpoint;
    
    console.log("Using API Endpoints:", {
      jdSearchEndpoint,
      bedrockAnalysisEndpoint
    });
    
    // Use the config or hardcoded values
    const amplifyConfig = {
      Auth: {
        region: config.region || hardcodedConfig.region,
        userPoolId: config.userPoolId || hardcodedConfig.userPoolId,
        userPoolWebClientId: config.userPoolWebClientId || hardcodedConfig.userPoolWebClientId,
        oauth: config.oauth || hardcodedConfig.oauth,
        mandatorySignIn: true
      },
      API: {
        endpoints: [
          {
            name: 'jdSearchApi',
            endpoint: jdSearchEndpoint,
            region: config.region || hardcodedConfig.region,
            custom_header: async () => {
              try {
                // Try to get a valid authentication token
                const session = await Amplify.Auth.currentSession();
                const token = session.getIdToken().getJwtToken();
                return {
                  Authorization: `Bearer ${token}`
                };
              } catch (error) {
                console.warn('Failed to get auth token:', error);
                // Don't provide a fallback authorization value
                // This will force a proper authentication
                throw new Error('Authentication required');
              }
            }
          },
          {
            name: 'bedrockAnalysisApi',
            endpoint: bedrockAnalysisEndpoint,
            region: config.region || hardcodedConfig.region,
            custom_header: async () => {
              try {
                // Try to get a valid authentication token
                const session = await Amplify.Auth.currentSession();
                const token = session.getIdToken().getJwtToken();
                return {
                  Authorization: `Bearer ${token}`
                };
              } catch (error) {
                console.warn('Failed to get auth token:', error);
                throw new Error('Authentication required');
              }
            }
          }
        ]
      }
    };

    // Configure Amplify
    Amplify.configure(amplifyConfig);

    // For debugging
    console.log("Amplify configured with:", {
      region: amplifyConfig.Auth.region,
      userPoolId: amplifyConfig.Auth.userPoolId,
      userPoolWebClientId: amplifyConfig.Auth.userPoolWebClientId,
      jdSearchApi: amplifyConfig.API.endpoints[0].endpoint,
      bedrockAnalysisApi: amplifyConfig.API.endpoints[1].endpoint
    });
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} autoHideDuration={4000} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes with Layout */}
            <Route element={<ProtectedRoute />}>
              {/* Routes with Header and Layout */}
              <Route path="/" element={
                <div className="app-container">
                  <Header />
                  <main className="main-content">
                    <Navigate to="/dashboard" replace />
                  </main>
                </div>
              } />
              
              <Route path="/dashboard" element={
                <div className="app-container">
                  <Header />
                  <main className="main-content">
                    <Dashboard />
                  </main>
                </div>
              } />
              
              {/* New LangChain Example Route */}
              <Route path="/langchain-example" element={
                <div className="app-container">
                  <Header />
                  <main className="main-content">
                    <LangchainBedrockExample />
                  </main>
                </div>
              } />
            </Route>
            
            {/* Test Route - Not Protected */}
            <Route path="/apitest" element={<ApiTest />} />
            
            {/* Bedrock API Test - Not Protected */}
            <Route path="/bedrocktest" element={<BedrockApiTest />} />
            
            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
