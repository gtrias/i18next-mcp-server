import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import I18nTranslationServer from '../src/index.js';

describe('MCP Protocol Tests', () => {
  let server: I18nTranslationServer;

  beforeAll(async () => {
    // Create server instance
    server = new I18nTranslationServer();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should create server instance successfully', () => {
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(I18nTranslationServer);
  });

  it('should have proper MCP server structure', () => {
    // Verify the server has the expected methods
    expect(typeof server.start).toBe('function');
    expect(server.constructor.name).toBe('I18nTranslationServer');
  });

  it('should export default server class', async () => {
    const { default: ServerClass } = await import('../src/index.js');
    expect(ServerClass).toBeDefined();
    expect(typeof ServerClass).toBe('function');
    
    // Should be able to create new instance
    const newServer = new ServerClass();
    expect(newServer).toBeInstanceOf(ServerClass);
  });

  it('should handle server start method', async () => {
    // We can't actually start the server in tests (it would conflict with stdio)
    // But we can verify the method exists and is callable
    expect(typeof server.start).toBe('function');
    
    // The start method should be async
    const startPromise = server.start();
    expect(startPromise).toBeInstanceOf(Promise);
    
    // We need to catch the error since it will fail without proper stdio setup
    try {
      await startPromise;
    } catch (error) {
      // This is expected in test environment - the server tries to connect to stdio
      expect(error).toBeDefined();
    }
  });
}); 