# i18next MCP Server

[![npm version](https://badge.fury.io/js/i18next-mcp-server.svg)](https://badge.fury.io/js/i18next-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides translation management capabilities for i18next projects, enabling AI assistants like Cursor to directly interact with translation files.

## 🚀 Quick Setup

The easiest way to use this MCP server is with npx. No installation required:

```bash
npx i18next-mcp-server@latest --help
```

## 🔧 Cursor Configuration

Add this to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "i18next-translation": {
      "command": "npx",
      "args": ["i18next-mcp-server@latest"],
      "env": {
        "I18N_PROJECT_ROOT": "/path/to/your/project",
        "I18N_LOCALES_PATH": "public/locales",
        "I18N_DEFAULT_LANGUAGE": "en",
        "I18N_SUPPORTED_LANGUAGES": "en,es,fr"
      }
    }
  }
}
```

For detailed setup instructions, see [CURSOR_SETUP.md](./CURSOR_SETUP.md).

## 📁 Expected Project Structure

```
your-project/
├── public/locales/          # Translation files
│   ├── en/
│   │   ├── common.json
│   │   └── navigation.json
│   ├── es/
│   │   ├── common.json
│   │   └── navigation.json
│   └── ...
└── src/                     # Your source code
```

## 🛠️ Available Tools

### Core Tools
- **`get_project_info`** - Get project configuration and statistics
- **`health_check`** - Analyze translation file health and completeness
- **`scan_code_for_missing_keys`** - Find missing translation keys in your code

### Key Management
- **`add_translation_key`** - Add new translation keys
- **`sync_missing_keys`** - Sync missing keys between languages
- **`get_missing_keys`** - List missing keys by language

### File Operations
- **`list_files`** - List all translation files
- **`validate_files`** - Validate JSON syntax
- **`export_data`** - Export translations to various formats

### Analysis
- **`coverage_report`** - Translation coverage statistics
- **`usage_analysis`** - Find unused translation keys
- **`quality_analysis`** - Analyze translation quality

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `I18N_PROJECT_ROOT` | Your project root directory | Current directory |
| `I18N_LOCALES_PATH` | Path to translation files | `public/locales` |
| `I18N_DEFAULT_LANGUAGE` | Source language | `en` |
| `I18N_SUPPORTED_LANGUAGES` | Comma-separated language codes | `en` |

## 🧪 Development

```bash
git clone https://github.com/gtrias/i18next-mcp-server.git
cd i18next-mcp-server
npm install
npm run build
npm test
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Setup Guide](./CURSOR_SETUP.md)
- [Contributing](./CONTRIBUTING.md)
- [Issues](https://github.com/gtrias/i18next-mcp-server/issues)