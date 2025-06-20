# Cursor MCP Integration Setup Guide

## Quick Setup

Create or edit the file: `~/.cursor/mcp_settings.json`

```json
{
  "mcpServers": {
    "i18next": {
      "command": "npx",
      "args": ["-y", "i18next-mcp-server@latest"],
      "env": {
        "I18N_PROJECT_ROOT": "/absolute/path/to/your/project",
        "I18N_LOCALES_DIR": "public/locales",
        "I18N_LANGUAGES": "en,es,fr",
        "I18N_DEFAULT_LANGUAGE": "en"
      }
    }
  }
}
```

## Environment Variables

- **I18N_PROJECT_ROOT**: **MUST be absolute path** to your project root
- **I18N_LOCALES_DIR**: Relative path from project root to locales folder
- **I18N_LANGUAGES**: Comma-separated list of language codes
- **I18N_DEFAULT_LANGUAGE**: Default/source language

## Example Configurations

### Next.js projects:
```json
{
  "mcpServers": {
    "i18next": {
      "command": "npx",
      "args": ["-y", "i18next-mcp-server@latest"],
      "env": {
        "I18N_PROJECT_ROOT": "/home/user/my-nextjs-app",
        "I18N_LOCALES_DIR": "public/locales",
        "I18N_LANGUAGES": "en,es,fr,de",
        "I18N_DEFAULT_LANGUAGE": "en"
      }
    }
  }
}
```

### React projects:
```json
{
  "mcpServers": {
    "i18next": {
      "command": "npx",
      "args": ["-y", "i18next-mcp-server@latest"],
      "env": {
        "I18N_PROJECT_ROOT": "/home/user/my-react-app",
        "I18N_LOCALES_DIR": "src/locales",
        "I18N_LANGUAGES": "en,es,ca",
        "I18N_DEFAULT_LANGUAGE": "en"
      }
    }
  }
}
```

## Testing Your Setup

Verify the server works:
```bash
I18N_PROJECT_ROOT="/path/to/your/project" I18N_LOCALES_DIR="public/locales" I18N_LANGUAGES="en,es,fr" npx i18next-mcp-server@latest --test
```

## Available Tools

After setup, you'll have access to these i18next tools in Cursor:
- **get_project_info** - Get project configuration and status
- **health_check** - Comprehensive health check on translation files
- **validate_files** - Validate JSON syntax and structure
- **list_files** - List all translation files
- **coverage_report** - Generate coverage report
- **quality_analysis** - Analyze translation quality
- **usage_analysis** - Analyze translation key usage
- **export_data** - Export translations in various formats
- **sync_missing_keys** - Sync missing keys across languages
- **add_translation_key** - Add new translation keys
- **get_missing_keys** - Get detailed list of missing keys
- **scan_code_for_missing_keys** - Scan code for missing translation keys
- And more...

## Cursor Rules Setup (Recommended)

Create a `.cursorrules` file in your project root to help Cursor understand how to use the i18next MCP server effectively:

> **Tip**: You can copy the example file from the npm package: `cp node_modules/i18next-mcp-server/.cursorrules.example .cursorrules`

```
# i18next Translation Management Rules

## Available MCP Tools
You have access to i18next-mcp-server tools for managing translations:

### Core Tools:
- `get_project_info` - Get project configuration and translation status
- `health_check` - Check translation files for issues (use summary: true for quick overview)
- `validate_files` - Validate JSON syntax and structure
- `list_files` - List all translation files with metadata

### Analysis Tools:
- `coverage_report` - Generate translation coverage statistics
- `quality_analysis` - Analyze translation quality and consistency
- `usage_analysis` - Find unused translation keys in code
- `scan_code_for_missing_keys` - Scan codebase for missing translation keys

### Management Tools:
- `sync_missing_keys` - Add missing keys across all languages
- `add_translation_key` - Add new translation keys with values
- `get_missing_keys` - Get detailed list of missing keys by language
- `export_data` - Export translations in various formats (json, csv, xlsx)

## Translation Workflow Guidelines:

1. **Before making translation changes**: Always run `health_check` with summary: true
2. **When adding new features**: Use `scan_code_for_missing_keys` to find missing translations
3. **For translation consistency**: Use `quality_analysis` to identify issues
4. **When managing keys**: Use `sync_missing_keys` to ensure all languages have the same keys
5. **For project overview**: Start with `get_project_info` to understand the current state

## Best Practices:
- Always sync missing keys before adding new translations
- Use the health check to identify issues before committing changes
- Check coverage reports to ensure translation completeness
- Validate files after manual edits to catch JSON syntax errors
- Use meaningful namespaces to organize translations logically

## Common Commands:
- Quick status check: `health_check` with summary: true
- Find missing translations: `get_missing_keys` with format: "summary"
- Add missing keys: `sync_missing_keys` with appropriate target languages
- Export for translators: `export_data` with format: "xlsx" or "csv"

When working with translations, prefer using these MCP tools over manual file editing to ensure consistency and catch issues early.
```

## Troubleshooting

1. **Restart Cursor** after updating `mcp_settings.json`
2. **Use absolute paths** for `I18N_PROJECT_ROOT`
3. **Check Cursor logs** for detailed error messages
4. **Validate your JSON** configuration file

For more help, check the [GitHub repository](https://github.com/gtrias/i18next-mcp-server). 