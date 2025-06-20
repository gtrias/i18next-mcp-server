# i18next MCP Server

[![npm version](https://badge.fury.io/js/i18next-mcp-server.svg)](https://badge.fury.io/js/i18next-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

A comprehensive Model Context Protocol (MCP) server that provides automated translation management capabilities for Cursor and other AI assistants, enabling direct interaction with i18next translation files, health checking, missing key detection, and automated translation workflows.

## 🚀 Installation

### Global Installation (Recommended)

```bash
npm install -g i18next-mcp-server
```

### Local Installation

```bash
npm install i18next-mcp-server
```

### From Source

```bash
git clone https://github.com/gtrias/i18next-mcp-server.git
cd i18next-mcp-server
npm install
npm run build
```

## 📋 Prerequisites

- Node.js >= 18.0.0
- An existing i18next project with translation files
- (Optional) i18next-scanner configuration for enhanced functionality

## 🔧 Configuration

### MCP Configuration for Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp_settings.json`):

```json
{
  "mcpServers": {
    "i18next-translation": {
      "command": "i18next-mcp-server",
      "args": [],
      "env": {
        "I18N_PROJECT_ROOT": "/path/to/your/project",
        "I18N_LOCALES_PATH": "public/locales",
        "I18N_DEFAULT_LANGUAGE": "en",
        "I18N_SUPPORTED_LANGUAGES": "en,es,fr,de"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `I18N_PROJECT_ROOT` | Root directory of your i18next project | `process.cwd()` |
| `I18N_LOCALES_PATH` | Path to translation files (relative to project root) | `public/locales` |
| `I18N_DEFAULT_LANGUAGE` | Default/source language code | `en` |
| `I18N_SUPPORTED_LANGUAGES` | Comma-separated list of supported languages | `en` |
| `I18N_NAMESPACES` | Comma-separated list of namespaces | `common` |
| `I18N_SCANNER_CONFIG` | Path to i18next-scanner config file | `i18next-scanner.config.js` |

### Project Structure

The server expects your i18next project to follow this structure:

```
your-project/
├── public/locales/          # Translation files directory
│   ├── en/                  # English translations
│   │   ├── common.json
│   │   └── navigation.json
│   ├── es/                  # Spanish translations
│   │   ├── common.json
│   │   └── navigation.json
│   └── ...
├── src/                     # Source code to scan
├── i18next-scanner.config.js  # Optional scanner config
└── package.json
```

## 🎯 Quick Start

### 1. Initial Health Check

After installing and configuring, run a health check through Cursor:

```bash
# Use Cursor's MCP integration to run:
health_check
```

### 2. Scan for Missing Keys

```bash
# Detect missing keys and get automated action recommendations:
scan_code_for_missing_keys
```

### 3. Fix Missing Keys Automatically

```bash
# Based on scan results, run targeted fixes:
sync_missing_keys --targetLanguages=es,fr --namespaces=common
```

### 4. Clean Up Orphaned Keys

```bash
# Remove unused translation keys:
usage_analysis  # First analyze
# Then manually remove keys identified as orphaned
```

## 🛠️ Available MCP Tools

### Core Analysis Tools

#### `get_project_info`
Get comprehensive project configuration and statistics.

#### `health_check`
Perform comprehensive health analysis of translation files.
- `--languages=en,es,fr` - Filter by specific languages
- `--namespaces=common` - Filter by specific namespaces  
- `--detailed=true` - Include detailed analysis
- `--summary=true` - AI-friendly summary format

#### `scan_code_for_missing_keys` ⭐
**Primary Cursor tool** - Scan codebase and get automated action recommendations.

### Key Management Tools

#### `sync_missing_keys`
Synchronize missing keys from source language to target languages.
- `--sourceLanguage=en` - Source language (default: en)
- `--targetLanguages=es,fr` - Target languages to sync
- `--namespaces=common` - Specific namespaces
- `--placeholder=""` - Placeholder text for missing keys
- `--dryRun=true` - Preview changes without applying
- `--createBackup=true` - Create backup before changes

#### `add_translation_key`
Add a specific translation key with values across languages.

#### `sync_all_missing`
Comprehensive sync to ensure all languages have all keys.

### Analysis & Reporting Tools

#### `coverage_report`
Generate detailed translation coverage statistics.

#### `quality_analysis`
Analyze translation quality with A-F scoring system.

#### `usage_analysis`
Analyze translation key usage patterns in codebase.

#### `get_missing_keys`
Get detailed breakdown of missing keys by language/namespace.

### Utility Tools

#### `list_files`
List all translation files with metadata.

#### `validate_files`
Validate JSON syntax and structure.

#### `export_data`
Export translation data in various formats (JSON, CSV, XLSX, Gettext).

## 🔍 Features

### 🎯 **Code Scanning & Analysis**
- **Real-time scanning** using your existing i18next-scanner configuration
- **Missing key detection** across all languages and namespaces
- **Orphaned key identification** for cleanup recommendations
- **Usage pattern analysis** with namespace-specific insights

### 🤖 **Automated Cursor Actions**
- **One-click fixes** for missing translation keys
- **Smart prioritization** (high/medium/low) based on impact
- **Dry-run capabilities** for safe preview before changes
- **Bulk operations** for efficient translation management

### 📊 **Health & Quality Monitoring**
- **Comprehensive health checks** with A-F quality grading
- **Cross-language consistency** validation
- **Interpolation parameter** verification
- **Translation quality** analysis and scoring

### 🔄 **Workflow Integration**
- **Seamless integration** with existing i18next-scanner and Gulp tasks
- **Backup functionality** before destructive operations
- **Multi-format exports** (JSON, CSV, Gettext)
- **Real-time file monitoring** for live updates

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Format code
npm run format
```

## 🚀 Development

```bash
# Clone repository
git clone https://github.com/gtrias/i18next-mcp-server.git
cd i18next-mcp-server

# Install dependencies
npm install

# Build project
npm run build

# Start development server
npm run dev

# Watch mode
npm run build:watch
```

## 📖 API Documentation

For detailed API documentation and advanced usage examples, see [API.md](./API.md).

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📋 [Issue Tracker](https://github.com/gtrias/i18next-mcp-server/issues)
- 💬 [Discussions](https://github.com/gtrias/i18next-mcp-server/discussions)

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP specification
- [i18next](https://www.i18next.com/) for the internationalization framework
- [Cursor](https://cursor.sh/) for AI-powered development tools

---

Made with ❤️ by the Genar