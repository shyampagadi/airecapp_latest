const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add polyfills for Node.js core modules used by AWS SDK
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve('crypto-browserify'),
    "stream": require.resolve('stream-browserify'),
    "path": require.resolve('path-browserify'),
    "os": require.resolve('os-browserify/browser'),
    "http": require.resolve('stream-http'),
    "https": require.resolve('https-browserify'),
    "util": require.resolve('util/'),
    "buffer": require.resolve('buffer/'),
    "process": false,
    "vm": false,
    "fs": false,
    "child_process": false,
  };
  
  // Add process and buffer polyfills
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer']
    })
  );

  // Handle ESM issues
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "assert": false
  };

  return config;
}; 