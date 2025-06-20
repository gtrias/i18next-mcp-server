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