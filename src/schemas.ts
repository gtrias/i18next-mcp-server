import { z } from 'zod';

// Schema for get_project_info (no parameters)
export const getProjectInfoSchema = z.object({});

// Schema for health_check
export const healthCheckSchema = z.object({
  languages: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional(),
  detailed: z.boolean().default(false),
  summary: z.boolean().default(false)
});

// Schema for validate_files
export const validateFilesSchema = z.object({
  fix: z.boolean().default(false)
});

// Schema for list_files
export const listFilesSchema = z.object({
  language: z.string().optional(),
  namespace: z.string().optional()
});

// Schema for coverage_report
export const coverageReportSchema = z.object({
  languages: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional()
});

// Schema for quality_analysis
export const qualityAnalysisSchema = z.object({
  languages: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional()
});

// Schema for usage_analysis
export const usageAnalysisSchema = z.object({
  sourceCodePaths: z.array(z.string()).default(['src/'])
});

// Schema for export_data
export const exportDataSchema = z.object({
  format: z.enum(['json', 'csv', 'xlsx', 'gettext']),
  languages: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional()
});

// Schema for sync_missing_keys
export const syncMissingKeysSchema = z.object({
  sourceLanguage: z.string().default('en'),
  targetLanguages: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional(),
  placeholder: z.string().default(''),
  dryRun: z.boolean().default(false),
  createBackup: z.boolean().default(true)
});

// Schema for add_translation_key
export const addTranslationKeySchema = z.object({
  key: z.string().describe('Translation key to add (supports nested keys with dot notation)'),
  translations: z.record(z.string()).describe('Object with language codes as keys and translation values'),
  namespaces: z.array(z.string()).optional(),
  overwrite: z.boolean().default(false),
  createBackup: z.boolean().default(true)
});

// Schema for sync_from_source
export const syncFromSourceSchema = z.object({
  keys: z.array(z.string()),
  sourceLanguage: z.string().default('en'),
  targetLanguages: z.array(z.string()),
  namespaces: z.array(z.string()).optional(),
  copyValues: z.boolean().default(false),
  createBackup: z.boolean().default(true)
});

// Schema for sync_all_missing
export const syncAllMissingSchema = z.object({
  placeholder: z.string().default(''),
  createBackup: z.boolean().default(true),
  dryRun: z.boolean().default(false)
});

// Schema for get_missing_keys
export const getMissingKeysSchema = z.object({
  sourceLanguage: z.string().default('en'),
  targetLanguages: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional(),
  format: z.enum(['detailed', 'summary', 'flat']).default('detailed')
});

// Schema for scan_code_for_missing_keys
export const scanCodeForMissingKeysSchema = z.object({
  sourceCodePaths: z.array(z.string()).default(['src/'])
}); 