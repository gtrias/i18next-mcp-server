#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== i18next MCP Server Test ===\n');

// Test configuration
const testConfig = {
  I18N_PROJECT_ROOT: '/home/genar/src/galleries',
  I18N_LOCALES_DIR: 'apps/client/public/locales',
  I18N_LANGUAGES: 'en,es,ca',
  I18N_NAMESPACES: 'translation,backoffice,landing,common,error',
  I18N_DEFAULT_LANGUAGE: 'en',
  I18N_FALLBACK_LANGUAGE: 'en',
  NODE_ENV: 'development'
};

console.log('Test Configuration:');
console.log(JSON.stringify(testConfig, null, 2));
console.log('');

// Test 1: Check if the package can be executed
console.log('Test 1: Basic package execution...');
try {
  const basicTest = spawn('npx', ['i18next-mcp-server@1.0.1', '--help'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5000
  });

  let basicOutput = '';
  let basicError = '';

  basicTest.stdout.on('data', (data) => {
    basicOutput += data.toString();
  });

  basicTest.stderr.on('data', (data) => {
    basicError += data.toString();
  });

  await new Promise((resolve) => {
    basicTest.on('close', (code) => {
      console.log(`Basic test exit code: ${code}`);
      console.log(`Basic stdout: ${basicOutput || '(empty)'}`);
      console.log(`Basic stderr: ${basicError || '(empty)'}`);
      resolve();
    });
  });
} catch (error) {
  console.log('Basic test failed:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 2: Test MCP server with proper environment
console.log('Test 2: MCP Server with environment variables...');

const env = {
  ...process.env,
  ...testConfig
};

const child = spawn('npx', ['i18next-mcp-server@1.0.1'], {
  env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';
let responses = [];

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('STDOUT:', text.trim());
  
  // Try to parse JSON responses
  const lines = text.split('\n').filter(line => line.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      responses.push(parsed);
      console.log('PARSED RESPONSE:', JSON.stringify(parsed, null, 2));
    } catch {
      // Not JSON, ignore
    }
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.log('STDERR:', text.trim());
});

child.on('close', (code) => {
  console.log(`\nMCP Server exited with code: ${code}`);
  console.log(`Total responses received: ${responses.length}`);
});

// Send MCP initialization sequence
console.log('\nSending MCP initialization...');

// 1. Initialize
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

console.log('Sending initialize request...');
child.stdin.write(JSON.stringify(initRequest) + '\n');

await setTimeout(1000);

// 2. Initialized notification
const initializedNotification = {
  jsonrpc: "2.0",
  method: "notifications/initialized"
};

console.log('Sending initialized notification...');
child.stdin.write(JSON.stringify(initializedNotification) + '\n');

await setTimeout(500);

// 3. List tools
const toolsRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {}
};

console.log('Sending tools/list request...');
child.stdin.write(JSON.stringify(toolsRequest) + '\n');

await setTimeout(1000);

// 4. Test a simple tool call
const projectInfoRequest = {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "get_project_info",
    arguments: {}
  }
};

console.log('Sending get_project_info tool call...');
child.stdin.write(JSON.stringify(projectInfoRequest) + '\n');

await setTimeout(2000);

// 5. Test health check
const healthCheckRequest = {
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: {
    name: "health_check",
    arguments: {
      summary: true
    }
  }
};

console.log('Sending health_check tool call...');
child.stdin.write(JSON.stringify(healthCheckRequest) + '\n');

await setTimeout(2000);

console.log('\nTerminating server...');
child.kill('SIGTERM');

await setTimeout(1000);

console.log('\n' + '='.repeat(50));
console.log('TEST SUMMARY');
console.log('='.repeat(50));
console.log(`Final output length: ${output.length} chars`);
console.log(`Final error output length: ${errorOutput.length} chars`);
console.log(`Total JSON responses: ${responses.length}`);

if (responses.length > 0) {
  console.log('\nReceived responses:');
  responses.forEach((response, index) => {
    console.log(`${index + 1}. ${JSON.stringify(response, null, 2)}`);
  });
} else {
  console.log('\n❌ No JSON responses received from MCP server');
}

if (errorOutput.includes('Configuration loaded successfully')) {
  console.log('✅ Configuration loaded successfully');
} else {
  console.log('❌ Configuration may have failed to load');
}

if (output.length === 0 && errorOutput.length === 0) {
  console.log('❌ No output at all - server may not be starting');
} else if (output.length === 0 && errorOutput.length > 0) {
  console.log('⚠️  Only stderr output - server started but no JSON-RPC responses');
} else {
  console.log('✅ Server produced output');
}

console.log('\nDone.'); 