import React, { useState } from 'react';
import axios from 'axios';
import { Button, Container, Card, Alert } from 'react-bootstrap';

const ApiTest = () => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = 'https://p1w63vjfu7.execute-api.us-east-1.amazonaws.com/dev/resumes';
  const TEST_JD = 'Java Developer with 5+ years experience';

  const testDirectApi = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing direct API call to:', API_URL);
      const response = await axios.get(API_URL, {
        params: { job_description: TEST_JD },
        headers: { 'Content-Type': 'application/json' },
        withCredentials: false
      });
      
      console.log('Response received:', response.data);
      setResult(response.data);
    } catch (error) {
      console.error('API test error:', error);
      if (error.response) {
        setError(`Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        setError('No response received. CORS or network issue.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const testCorsProxyApi = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
      const proxyUrl = CORS_PROXY + API_URL;
      
      console.log('Testing API call through CORS proxy:', proxyUrl);
      const response = await axios.get(proxyUrl, {
        params: { job_description: TEST_JD },
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest' 
        },
        withCredentials: false
      });
      
      console.log('Response received through proxy:', response.data);
      setResult(response.data);
    } catch (error) {
      console.error('CORS proxy API test error:', error);
      if (error.response) {
        setError(`Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        setError('No response received. CORS or network issue.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-4">
      <Card>
        <Card.Body>
          <h2>API Test</h2>
          <div className="mb-3">
            <Button 
              variant="primary" 
              onClick={testDirectApi} 
              disabled={loading}
              className="me-2"
            >
              Test Direct API
            </Button>
            <Button 
              variant="secondary" 
              onClick={testCorsProxyApi} 
              disabled={loading}
            >
              Test with CORS Proxy
            </Button>
          </div>
          
          {loading && <Alert variant="info">Loading...</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          
          {result && (
            <div>
              <h3>API Response:</h3>
              <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ApiTest; 