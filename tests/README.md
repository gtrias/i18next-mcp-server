# Tests

Simple testing setup for i18next-mcp-server to ensure it works correctly with MCP clients like Cursor.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Test Structure

- `mcp-protocol.test.ts` - Tests MCP protocol compliance
- `core-tools.test.ts` - Tests main MCP tools (get_project_info, health_check, validate_files)
- `error-handling.test.ts` - Tests error scenarios
- `cursor-integration.test.ts` - End-to-end test simulating Cursor usage

## Goal

Ensure users can successfully integrate the i18next-mcp-server with Cursor without errors. 