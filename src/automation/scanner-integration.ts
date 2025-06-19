import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { I18nConfig } from '../types/index.js';

const execAsync = promisify(exec);

export interface ScannerResult {
  success: boolean;
  extractedKeys: string[];
  totalKeys: number;
  affectedFiles: string[];
  errors: string[];
  scanTime: number;
  outputPath?: string;
}

export interface MissingKeysAnalysis {
  language: string;
  namespace: string;
  missingKeys: string[];
  totalMissing: number;
}

export interface UsageAnalysis {
  totalUsedKeys: number;
  unusedKeys: string[];
  orphanedKeys: string[];
  keysByNamespace: Record<string, string[]>;
  keysByFile: Record<string, string[]>;
}

export class I18nextScannerIntegration {
  private config: I18nConfig;
  private projectRoot: string;

  constructor(config: I18nConfig) {
    this.config = config;
    this.projectRoot = '/home/genar/src/galleries'; // Set to the actual project root
  }

  /**
   * Run i18next-scanner to extract keys from codebase
   */
  async scanCodebase(options: {
    extract?: boolean;
    clean?: boolean;
    namespace?: string;
    createBackup?: boolean;
  } = {}): Promise<ScannerResult> {
    const startTime = Date.now();
    const result: ScannerResult = {
      success: false,
      extractedKeys: [],
      totalKeys: 0,
      affectedFiles: [],
      errors: [],
      scanTime: 0
    };

    try {
      let command: string;
      
      if (options.extract) {
        command = 'npm run i18n:extract';
        result.outputPath = './temp-i18n-extract/';
      } else if (options.clean) {
        command = 'npm run i18n:clean';
      } else if (options.namespace) {
        command = `I18N_NAMESPACE=${options.namespace} npx gulp i18n:scan-namespace`;
      } else {
        command = 'npm run i18n:scan';
      }

      console.log(`Running: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stderr && !stderr.includes('Warning')) {
        result.errors.push(stderr);
      }

      // Parse the scanner output to extract information
      const outputLines = stdout.split('\n');
      result.extractedKeys = this.parseExtractedKeys(outputLines);
      result.totalKeys = result.extractedKeys.length;
      result.affectedFiles = this.parseAffectedFiles(outputLines);
      result.success = true;

      console.log(`Scanner completed successfully. Found ${result.totalKeys} keys.`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      console.error('Scanner failed:', errorMessage);
    }

    result.scanTime = Date.now() - startTime;
    return result;
  }

  /**
   * Analyze missing keys across all languages and namespaces
   */
  async analyzeMissingKeys(): Promise<MissingKeysAnalysis[]> {
    const analysis: MissingKeysAnalysis[] = [];
    
    try {
      // First, extract current keys from codebase
      const extractResult = await this.scanCodebase({ extract: true });
      if (!extractResult.success) {
        throw new Error('Failed to extract keys from codebase');
      }

      // Get all extracted translation files
      const extractPath = './temp-i18n-extract/';
      const languages = this.config.languages || ['en', 'es', 'ca'];
      const namespaces = this.config.namespaces || ['translation'];

      for (const lang of languages) {
        for (const ns of namespaces) {
          const extractedFilePath = path.join(extractPath, 'apps/client/public/locales', lang, `${ns}.json`);
          const currentFilePath = path.join('apps/client/public/locales', lang, `${ns}.json`);

          try {
            // Read extracted keys (what should exist)
            const extractedData = await this.readJSONFile(extractedFilePath);
            const extractedKeys = extractedData ? this.flattenKeys(extractedData) : [];

            // Read current translation file (what exists)
            const currentData = await this.readJSONFile(currentFilePath);
            const currentKeys = currentData ? this.flattenKeys(currentData) : [];

            // Find missing keys
            const missingKeys = extractedKeys.filter(key => !currentKeys.includes(key));

            if (missingKeys.length > 0 || extractedKeys.length > 0) {
              analysis.push({
                language: lang,
                namespace: ns,
                missingKeys,
                totalMissing: missingKeys.length
              });
            }
                     } catch (error) {
             console.warn(`Could not analyze ${lang}/${ns}:`, error instanceof Error ? error.message : String(error));
           }
        }
      }

      // Clean up temporary extraction
      await this.cleanupTempFiles('./temp-i18n-extract/');

    } catch (error) {
      console.error('Missing keys analysis failed:', error);
    }

    return analysis;
  }

  /**
   * Analyze key usage patterns and find orphaned keys
   */
  async analyzeKeyUsage(): Promise<UsageAnalysis> {
    const analysis: UsageAnalysis = {
      totalUsedKeys: 0,
      unusedKeys: [],
      orphanedKeys: [],
      keysByNamespace: {},
      keysByFile: {}
    };

    try {
      // Extract keys currently used in code
      const extractResult = await this.scanCodebase({ extract: true });
      if (!extractResult.success) {
        throw new Error('Failed to extract used keys');
      }

      // Read extracted translation files to get used keys
      const extractPath = './temp-i18n-extract/';
      const languages = this.config.languages || ['en', 'es', 'ca'];
      const namespaces = this.config.namespaces || ['translation'];
      
      const usedKeys = new Set<string>();
      const keysByNamespace: Record<string, Set<string>> = {};

             // Collect all used keys from extracted files
      for (const ns of namespaces) {
        keysByNamespace[ns] = new Set();
        
        for (const lang of languages) {
          const extractedFilePath = path.join(extractPath, 'apps/client/public/locales', lang, `${ns}.json`);
          
          try {
            const extractedData = await this.readJSONFile(extractedFilePath);
            if (extractedData) {
              const keys = this.flattenKeys(extractedData);
              for (const key of keys) {
                usedKeys.add(key);
                keysByNamespace[ns].add(key);
              }
            }
          } catch {
            // File might not exist, that's okay
          }
        }
      }

      // Now check current translation files for orphaned keys
      const allExistingKeys = new Set<string>();
      
      for (const lang of languages) {
        for (const ns of namespaces) {
          const currentFilePath = path.join('apps/client/public/locales', lang, `${ns}.json`);
          
                     try {
             const currentData = await this.readJSONFile(currentFilePath);
             if (currentData) {
               const keys = this.flattenKeys(currentData);
               for (const key of keys) {
                 allExistingKeys.add(key);
               }
             }
           } catch {
             // File might not exist
           }
        }
      }

      // Find orphaned keys (exist in translation files but not used in code)
      analysis.orphanedKeys = Array.from(allExistingKeys).filter(key => !usedKeys.has(key));
      analysis.totalUsedKeys = usedKeys.size;
      
      // Convert Sets to arrays for the result
      analysis.keysByNamespace = Object.fromEntries(
        Object.entries(keysByNamespace).map(([ns, keys]) => [ns, Array.from(keys)])
      );

      // Clean up temporary files
      await this.cleanupTempFiles('./temp-i18n-extract/');

    } catch (error) {
      console.error('Usage analysis failed:', error);
    }

    return analysis;
  }

  /**
   * Synchronize missing keys across all languages
   */
  async syncMissingKeys(options: {
    sourceLanguage?: string;
    targetLanguages?: string[];
    namespaces?: string[];
    placeholder?: string;
    dryRun?: boolean;
  } = {}): Promise<{ success: boolean; changes: Record<string, number>; errors: string[] }> {
    const {
      sourceLanguage = 'en',
      targetLanguages = this.config.languages?.filter(lang => lang !== sourceLanguage) || ['es', 'ca'],
      namespaces = this.config.namespaces || ['translation'],
      placeholder = '',
      dryRun = false
    } = options;

    const result = {
      success: false,
      changes: {} as Record<string, number>,
      errors: [] as string[]
    };

    try {
      // First scan to get latest keys
      const scanResult = await this.scanCodebase();
      if (!scanResult.success) {
        throw new Error('Failed to scan codebase for latest keys');
      }

      // Analyze missing keys
      const missingAnalysis = await this.analyzeMissingKeys();

      // Group missing keys by target language and namespace
      for (const analysis of missingAnalysis) {
        if (!targetLanguages.includes(analysis.language)) continue;
        if (!namespaces.includes(analysis.namespace)) continue;
        if (analysis.missingKeys.length === 0) continue;

        const changeKey = `${analysis.language}/${analysis.namespace}`;
        result.changes[changeKey] = analysis.missingKeys.length;

        if (!dryRun) {
          // Read source language file to get values
          const sourceFilePath = path.join('apps/client/public/locales', sourceLanguage, `${analysis.namespace}.json`);
          const targetFilePath = path.join('apps/client/public/locales', analysis.language, `${analysis.namespace}.json`);

          try {
            const sourceData = await this.readJSONFile(sourceFilePath) || {};
            const targetData = await this.readJSONFile(targetFilePath) || {};

            // Add missing keys
            for (const missingKey of analysis.missingKeys) {
              const sourceValue = this.getNestedValue(sourceData, missingKey);
              const valueToSet = sourceValue || placeholder || missingKey;
              this.setNestedValue(targetData, missingKey, valueToSet);
            }

            // Write updated file
            await this.writeJSONFile(targetFilePath, targetData);
            console.log(`Updated ${changeKey}: added ${analysis.missingKeys.length} keys`);

          } catch (error) {
            const errorMsg = `Failed to sync ${changeKey}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
          }
        }
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
    }

    return result;
  }

  // Helper methods
  private parseExtractedKeys(_outputLines: string[]): string[] {
    // This is a simplified parser - in practice, you'd analyze the generated files
    const keys: string[] = [];
    // The actual implementation would read the generated JSON files
    return keys;
  }

  private parseAffectedFiles(outputLines: string[]): string[] {
    // Parse scanner output to find which files were processed
    return outputLines
      .filter(line => line.includes('.tsx') || line.includes('.ts'))
      .map(line => line.trim())
      .filter(Boolean);
  }

  private async readJSONFile(filePath: string): Promise<Record<string, unknown> | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async writeJSONFile(filePath: string, data: Record<string, unknown>): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }

  private flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        keys.push(...this.flattenKeys(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => 
      (current as Record<string, unknown>)?.[key], obj);
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) return;
    
    const target = keys.reduce((current: Record<string, unknown>, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);
    
    target[lastKey] = value;
  }

  private async cleanupTempFiles(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
} 