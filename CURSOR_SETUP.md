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

## Troubleshooting

1. **Restart Cursor** after updating `mcp_settings.json`
2. **Use absolute paths** for `I18N_PROJECT_ROOT`
3. **Check Cursor logs** for detailed error messages
4. **Validate your JSON** configuration file

For more help, check the [GitHub repository](https://github.com/gtrias/i18next-mcp-server). 