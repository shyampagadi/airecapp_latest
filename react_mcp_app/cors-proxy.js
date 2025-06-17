// cors-proxy.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Create SSE proxy with modified headers
const sseProxy = createProxyMiddleware({
  target: 'http://localhost:8050',
  changeOrigin: true,
  ws: false,
  selfHandleResponse: true,
  onProxyRes: (proxyRes, req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Copy all headers from proxy response
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    
    // Pipe the proxy response to client
    proxyRes.pipe(res);
  }
});

// Proxy all other requests
const apiProxy = createProxyMiddleware({
  target: 'http://localhost:8050',
  changeOrigin: true,
});

// Handle preflight OPTIONS requests for SSE
app.options('/sse', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Use SSE specific proxy for /sse endpoint
app.use('/sse', sseProxy);

// Use standard proxy for all other routes
app.use('/', apiProxy);

const PORT = 8051;
app.listen(PORT, () => {
  console.log(`CORS Proxy running at http://localhost:${PORT}`);
  console.log(`Proxying requests to http://localhost:8050`);
}); 