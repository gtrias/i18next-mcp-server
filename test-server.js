#!/usr/bin/env node

// Simple test script for the MCP server
// This simulates basic MCP calls to test the server

const { spawn } = require('node:child_process');
const path = require('node:path');

const serverPath = path.join(__dirname, 'dist', 'index.js');

console.log('Testing i18next Translation MCP Server...');
console.log('Server path:', serverPath);

// Test basic server startup
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: '/home/genar/src/galleries'
});

let output = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Send a basic MCP request
setTimeout(() => {
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  server.stdin.write(`${JSON.stringify(initRequest)}\n`);
  
  // Wait for response then test list_tools
  setTimeout(() => {
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    server.stdin.write(`${JSON.stringify(listToolsRequest)}\n`);
    
    // Clean shutdown after tests
    setTimeout(() => {
      server.kill();
      console.log('\nServer output:', output);
      console.log('\nTest completed!');
    }, 1000);
  }, 500);
}, 100);

server.on('close', (code) => {
  console.log(`\nServer exited with code ${code}`);
}); 