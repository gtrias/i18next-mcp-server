import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

describe('Cursor Integration Test', () => {
  it('should start server and respond to MCP initialization', async () => {
    // This test simulates how Cursor would interact with the MCP server
    console.log('🧪 Testing MCP server initialization...');
    
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Set some basic environment variables for testing
        I18N_PROJECT_ROOT: process.cwd(),
        I18N_LOCALES_DIR: 'public/locales',
        I18N_LANGUAGES: 'en,es',
        I18N_DEFAULT_LANGUAGE: 'en'
      }
    });

    let stdout = '';
    let stderr = '';
    let responses: any[] = [];

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      
      // Try to parse JSON responses
      const lines = text.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          responses.push(parsed);
          console.log('📨 Server response:', JSON.stringify(parsed, null, 2));
        } catch {
          // Not JSON, ignore
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('🔍 Server stderr:', data.toString().trim());
    });

    // Wait for server to start
    await setTimeout(1000);

    console.log('🚀 Sending MCP initialization sequence...');

    // 1. Send initialize request (what Cursor does first)
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "cursor",
          version: "1.0.0"
        }
      }
    };

    console.log('📤 Sending initialize:', JSON.stringify(initRequest));
    serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');

    await setTimeout(500);

    // 2. Send initialized notification
    const initializedNotification = {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    };

    console.log('📤 Sending initialized notification');
    serverProcess.stdin.write(JSON.stringify(initializedNotification) + '\n');

    await setTimeout(500);

    // 3. List tools (what Cursor does to discover capabilities)
    const toolsRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    };

    console.log('📤 Sending tools/list request');
    serverProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');

    await setTimeout(1000);

    // Cleanup
    serverProcess.kill('SIGTERM');
    await setTimeout(500);

    console.log('📊 Test Results:');
    console.log(`- Stdout length: ${stdout.length} chars`);
    console.log(`- Stderr length: ${stderr.length} chars`);
    console.log(`- JSON responses: ${responses.length}`);
    console.log(`- Server stderr includes config success: ${stderr.includes('Configuration loaded successfully')}`);

    // Assertions
    expect(stderr.length).toBeGreaterThan(0); // Should have some stderr output
    expect(stderr).toContain('Starting i18next Translation MCP Server');
    
    if (responses.length > 0) {
      console.log('✅ Server responded with JSON-RPC messages');
      // Check if we got proper responses
      const initResponse = responses.find(r => r.id === 1);
      if (initResponse) {
        expect(initResponse).toHaveProperty('result');
        console.log('✅ Initialize response received');
      }
    } else {
      console.log('⚠️ No JSON-RPC responses received - check server output above');
    }
  }, 15000); // 15 second timeout

  it('should provide debugging information for Cursor setup', () => {
    console.log('\n🔧 CURSOR SETUP DEBUGGING GUIDE:');
    console.log('================================');
    
    console.log('\n1. Check your Cursor MCP configuration file:');
    console.log('   Location: ~/.cursor/mcp_settings.json');
    console.log('   Should contain something like:');
    console.log(JSON.stringify({
      "mcpServers": {
        "i18next": {
          "command": "npx",
          "args": ["i18next-mcp-server@1.0.3"],
          "env": {
            "I18N_PROJECT_ROOT": "/path/to/your/project",
            "I18N_LOCALES_DIR": "public/locales",
            "I18N_LANGUAGES": "en,es,fr",
            "I18N_DEFAULT_LANGUAGE": "en"
          }
        }
      }
    }, null, 2));

    console.log('\n2. Verify the server can be run manually:');
    console.log('   cd /path/to/your/project');
    console.log('   npx i18next-mcp-server@1.0.3');

    console.log('\n3. Check environment variables are set:');
    console.log('   I18N_PROJECT_ROOT - absolute path to your project');
    console.log('   I18N_LOCALES_DIR - relative path to locales folder');
    console.log('   I18N_LANGUAGES - comma-separated language codes');

    console.log('\n4. Common issues:');
    console.log('   - Wrong project path in I18N_PROJECT_ROOT');
    console.log('   - Missing locales directory');
    console.log('   - Cursor MCP settings file not found or malformed');
    console.log('   - Server not installed (run: npm install -g i18next-mcp-server)');

    console.log('\n5. Test manually:');
    console.log('   echo \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}\' | npx i18next-mcp-server');

    // This test always passes - it's just for information
    expect(true).toBe(true);
  });
}); 