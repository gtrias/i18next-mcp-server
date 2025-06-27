import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { I18nConfig } from '../types/index.js';

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
  private execAsync: (command: string, options?: any) => Promise<{ stdout: string; stderr: string }>;

  constructor(config: I18nConfig) {
    this.config = config;
    this.projectRoot = config.projectRoot || process.cwd();
    this.execAsync = promisify(exec);
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
      
      const { stdout, stderr } = await this.execAsync(command, {
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
          const extractedFilePath = path.join(extractPath, this.config.localesPath, lang, `${ns}.json`);
          const currentFilePath = path.join(this.config.localesPath, lang, `${ns}.json`);

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
          const extractedFilePath = path.join(extractPath, this.config.localesPath, lang, `${ns}.json`);
          
          try {
            const extractedData = await this.readJSONFile(extractedFilePath);
            if (extractedData) {
              const keys = this.flattenKeys(extractedData);
              keys.forEach(key => {
                usedKeys.add(key);
                keysByNamespace[ns].add(key);
              });
            }
          } catch (error) {
            console.warn(`Could not read extracted file ${extractedFilePath}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }

      // Now compare with actual translation files to find orphaned keys
      for (const lang of languages) {
        for (const ns of namespaces) {
          const currentFilePath = path.join(this.config.localesPath, lang, `${ns}.json`);
          
          try {
            const currentData = await this.readJSONFile(currentFilePath);
            if (currentData) {
              const currentKeys = this.flattenKeys(currentData);
              const orphaned = currentKeys.filter(key => !usedKeys.has(key));
              analysis.orphanedKeys.push(...orphaned);
              
              analysis.keysByFile[currentFilePath] = currentKeys;
            }
          } catch (error) {
            console.warn(`Could not read current file ${currentFilePath}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }

      analysis.totalUsedKeys = usedKeys.size;
      analysis.unusedKeys = Array.from(analysis.orphanedKeys);
      
      // Convert sets to arrays for final result
      for (const ns in keysByNamespace) {
        analysis.keysByNamespace[ns] = Array.from(keysByNamespace[ns]);
      }

      // Clean up temporary extraction
      await this.cleanupTempFiles('./temp-i18n-extract/');

    } catch (error) {
      console.error('Usage analysis failed:', error);
    }

    return analysis;
  }

  /**
   * Sync missing keys between languages
   */
  async syncMissingKeys(options: {
    sourceLanguage?: string;
    targetLanguages?: string[];
    namespaces?: string[];
    placeholder?: string;
    dryRun?: boolean;
  } = {}): Promise<{ success: boolean; changes: Record<string, number>; errors: string[] }> {
    const result = {
      success: false,
      changes: {} as Record<string, number>,
      errors: [] as string[]
    };

    try {
      const sourceLanguage = options.sourceLanguage || this.config.defaultLanguage || 'en';
      const targetLanguages = options.targetLanguages || this.config.languages?.filter(lang => lang !== sourceLanguage) || [];
      const namespaces = options.namespaces || this.config.namespaces || ['translation'];
      const placeholder = options.placeholder || '{{TRANSLATE_ME}}';

      // First scan to get current state
      const scanResult = await this.scanCodebase();
      if (!scanResult.success) {
        throw new Error('Failed to scan codebase for sync operation');
      }

      for (const ns of namespaces) {
        const sourceFilePath = path.join(this.config.localesPath, sourceLanguage, `${ns}.json`);
        
        try {
          const sourceData = await this.readJSONFile(sourceFilePath);
          if (!sourceData) {
            result.errors.push(`Source file not found: ${sourceFilePath}`);
            continue;
          }

          const sourceKeys = this.flattenKeys(sourceData);

          for (const targetLang of targetLanguages) {
            const targetFilePath = path.join(this.config.localesPath, targetLang, `${ns}.json`);
            
            try {
              let targetData = await this.readJSONFile(targetFilePath) || {};
              const targetKeys = this.flattenKeys(targetData);
              
              const missingKeys = sourceKeys.filter(key => !targetKeys.includes(key));
              
              if (missingKeys.length > 0) {
                // Add missing keys with placeholder values
                for (const key of missingKeys) {
                  const sourceValue = this.getNestedValue(sourceData, key);
                  if (sourceValue !== undefined) {
                    this.setNestedValue(targetData, key, placeholder);
                  }
                }

                if (!options.dryRun) {
                  // Ensure directory exists
                  await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
                  await this.writeJSONFile(targetFilePath, targetData);
                }

                result.changes[`${targetLang}/${ns}`] = missingKeys.length;
              }
            } catch (error) {
              result.errors.push(`Failed to process ${targetLang}/${ns}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } catch (error) {
          result.errors.push(`Failed to read source ${sourceLanguage}/${ns}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  private parseExtractedKeys(outputLines: string[]): string[] {
    const keys: string[] = [];
    
    for (const line of outputLines) {
      const trimmedLine = line.trim();
      
      // Look for common patterns in scanner output
      // Pattern 1: "Found key: keyName"
      if (trimmedLine.startsWith('Found key:')) {
        const key = trimmedLine.replace('Found key:', '').trim();
        if (key) keys.push(key);
      }
      
      // Pattern 2: "- keyName" (list format)
      if (trimmedLine.startsWith('- ') && !trimmedLine.includes('.tsx') && !trimmedLine.includes('.ts') && !trimmedLine.includes('.js')) {
        const key = trimmedLine.replace('- ', '').trim();
        if (key && !key.includes('/')) keys.push(key);
      }
      
      // Pattern 3: JSON-like format "keyName": "value"
      const jsonMatch = trimmedLine.match(/^"([^"]+)":\s*"[^"]*"$/);
      if (jsonMatch) {
        keys.push(jsonMatch[1]);
      }
      
      // Pattern 4: Simple key extraction from t('key') patterns
      const tFunctionMatch = trimmedLine.match(/t\(['"`]([^'"`]+)['"`]\)/g);
      if (tFunctionMatch) {
        for (const match of tFunctionMatch) {
          const keyMatch = match.match(/t\(['"`]([^'"`]+)['"`]\)/);
          if (keyMatch) {
            keys.push(keyMatch[1]);
          }
        }
      }
    }
    
    // Remove duplicates and empty keys
    return [...new Set(keys.filter(key => key && key.length > 0))];
  }

  private parseAffectedFiles(outputLines: string[]): string[] {
    const files: string[] = [];
    
    for (const line of outputLines) {
      const trimmedLine = line.trim();
      
      // Look for file paths in scanner output
      if (trimmedLine.includes('.tsx') || trimmedLine.includes('.ts') || trimmedLine.includes('.js') || trimmedLine.includes('.jsx')) {
        // Pattern 1: "Processing file: path/to/file.tsx"
        if (trimmedLine.startsWith('Processing file:')) {
          const file = trimmedLine.replace('Processing file:', '').trim();
          if (file) files.push(file);
        }
        
        // Pattern 2: "- path/to/file.tsx"
        if (trimmedLine.startsWith('- ') && (trimmedLine.includes('/') || trimmedLine.includes('\\'))) {
          const file = trimmedLine.replace('- ', '').trim();
          if (file) files.push(file);
        }
        
        // Pattern 3: Just a file path on its own line
        if (trimmedLine.match(/^[^\s]+\.(tsx?|jsx?|vue)$/)) {
          files.push(trimmedLine);
        }
      }
    }
    
    // Remove duplicates
    return [...new Set(files)];
  }

  private async readJSONFile(filePath: string): Promise<Record<string, unknown> | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async writeJSONFile(filePath: string, data: Record<string, unknown>): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}${this.config.keySeparator || '.'}${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys.push(...this.flattenKeys(obj[key] as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(this.config.keySeparator || '.');
    let current: any = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split(this.config.keySeparator || '.');
    let current: any = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private async cleanupTempFiles(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Failed to cleanup temp files:', error instanceof Error ? error.message : String(error));
    }
  }
} 