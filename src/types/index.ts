import { z } from 'zod';

// Configuration Schema
export const I18nConfigSchema = z.object({
  projectRoot: z.string(),
  localesPath: z.string().default('apps/client/public/locales'),
  languages: z.array(z.string()).default(['en', 'es', 'ca']),
  namespaces: z.array(z.string()).default(['translation', 'backoffice', 'landing', 'common', 'error']),
  defaultLanguage: z.string().default('en'),
  defaultNamespace: z.string().default('translation'),
  keySeparator: z.string().default('.'),
  nsSeparator: z.string().default(':'),
  interpolation: z.object({
    prefix: z.string().default('{{'),
    suffix: z.string().default('}}')
  }).default({}),
  backup: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('.backups/i18n')
  }).default({})
});

export type I18nConfig = z.infer<typeof I18nConfigSchema>;

// Translation Key Structure
export interface TranslationKey {
  key: string;
  namespace: string;
  value: string;
  interpolationParams: string[];
  context?: string;
  plural?: boolean;
}

// Translation File Structure
export interface TranslationFile {
  language: string;
  namespace: string;
  path: string;
  content: Record<string, unknown>;
  lastModified: Date;
  size: number;
}

// Health Check Results
export interface HealthCheckResult {
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    info: number;
    score: number;
  };
  files: Record<string, {
    keyCount: number;
    issueCount: number;
    issues: ValidationIssue[];
    qualityScore: QualityScore;
  }>;
  issues: ValidationIssue[];
  recommendations: string[];
  timestamp: Date;
}

export interface ValidationIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  suggestion?: string;
  location?: {
    language?: string;
    namespace?: string;
    key?: string;
  };
  details?: Record<string, unknown>;
}

export interface QualityScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalKeys: number;
  errorCount: number;
  warningCount: number;
}

// Legacy health check interface for backward compatibility
export interface HealthIssue {
  type: 'missing_key' | 'orphaned_key' | 'invalid_json' | 'inconsistent_interpolation' | 'untranslated_content' | 'malformed_placeholder' | 'empty_value' | 'suspicious_html';
  severity: 'error' | 'warning' | 'info';
  key?: string;
  description: string;
  suggestion?: string;
  affectedLanguages?: string[];
}

// Coverage Report
export interface CoverageReport {
  overall: {
    totalKeys: number;
    translatedKeys: number;
    percentage: number;
  };
  byLanguage: Record<string, {
    totalKeys: number;
    translatedKeys: number;
    percentage: number;
    missingKeys: string[];
  }>;
  byNamespace: Record<string, {
    totalKeys: number;
    translatedKeys: number;
    percentage: number;
  }>;
  recommendations: string[];
  generatedAt: Date;
}

// Usage Analysis
export interface UsageAnalysis {
  totalKeysInFiles: number;
  usedKeys: string[];
  unusedKeys: string[];
  missingKeys: string[];
  namespaceUsage: Record<string, {
    keysUsed: number;
    totalKeys: number;
    files: string[];
  }>;
  filesCovered: number;
  totalFiles: number;
  coveragePercentage: number;
  generatedAt: Date;
}

// Migration Operations
export interface MigrationOperation {
  type: 'add_key' | 'remove_key' | 'rename_key' | 'move_key' | 'update_value';
  key: string;
  newKey?: string;
  value?: string;
  namespace?: string;
  newNamespace?: string;
  affectedLanguages: string[];
  description: string;
}

export interface MigrationScript {
  operations: MigrationOperation[];
  description: string;
  createdAt: Date;
  canRollback: boolean;
}

// Quality Analysis
export interface QualityAnalysis {
  consistency: {
    score: number;
    issues: Array<{
      key: string;
      issue: string;
      languages: string[];
    }>;
  };
  completeness: {
    score: number;
    missingTranslations: Record<string, string[]>;
  };
  interpolation: {
    score: number;
    mismatches: Array<{
      key: string;
      languages: Record<string, string[]>;
    }>;
  };
  placeholders: {
    score: number;
    malformed: Array<{
      key: string;
      language: string;
      issue: string;
    }>;
  };
  overallScore: number;
  generatedAt: Date;
}

// MCP Tool Definitions
export interface I18nTool {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
}

// Server Events
export interface ServerEvent {
  type: 'file_changed' | 'file_added' | 'file_removed' | 'scan_completed' | 'health_check_completed';
  timestamp: Date;
  data: unknown;
}

// Error Types
export class I18nError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'I18nError';
  }
}

export class ValidationError extends I18nError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class FileSystemError extends I18nError {
  constructor(message: string, details?: unknown) {
    super(message, 'FILESYSTEM_ERROR', details);
  }
}

export class ConfigurationError extends I18nError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', details);
  }
}

// Key Management Types
export interface KeyOperation {
  type: 'add' | 'remove' | 'rename' | 'sync';
  key: string;
  languages?: string[];
  namespaces?: string[];
}

export interface KeyAddition extends KeyOperation {
  type: 'add';
  value?: string;
  defaultValue: string;
  overwrite?: boolean;
}

export interface KeyRemoval extends KeyOperation {
  type: 'remove';
}

export interface KeyRename extends KeyOperation {
  type: 'rename';
  oldKey: string;
  newKey: string;
  overwrite?: boolean;
}

export interface BatchKeyOperation {
  operations: KeyOperation[];
  createBackup?: boolean;
  continueOnError?: boolean;
}

export interface KeyConflict {
  key: string;
  language: string;
  namespace: string;
  existingValue: unknown;
}

export interface OperationResult {
  success: boolean;
  operations: Array<{
    type: string;
    key: string;
    newKey?: string;
    language: string;
    namespace: string;
    value?: unknown;
    timestamp: string;
  }>;
  conflicts: KeyConflict[];
  errors: string[];
} 