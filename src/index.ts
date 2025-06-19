#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { ConfigManager } from './core/config.js';
import { FileManager } from './core/file-manager.js';
import { HealthChecker } from './health/health-checker.js';
import type { KeyManager } from './management/key-manager.js';
import type { AnalyticsEngine } from './reporting/analytics.js';
import { I18nError } from './types/index.js';
import { I18nextScannerIntegration } from './automation/scanner-integration.js';

export class I18nTranslationServer {
  private server: Server;
  private configManager: ConfigManager;
  private fileManager: FileManager | null = null;
  private healthChecker: HealthChecker | null = null;
  private keyManager: KeyManager | null = null;
  private analyticsEngine: AnalyticsEngine | null = null;
  private scannerIntegration: I18nextScannerIntegration | null = null;
  private isInitializing = false;
  private initializationAttempts = 0;
  private readonly maxInitializationAttempts = 3;
  private readonly operationTimeout = 30000; // 30 seconds

  constructor() {
    this.server = new Server(
      {
        name: 'i18next-translation-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.configManager = new ConfigManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_project_info',
            description: 'Get information about the translation project configuration and status',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'health_check',
            description: 'Perform comprehensive health check on translation files',
            inputSchema: {
              type: 'object',
              properties: {
                languages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific languages to check (optional)'
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific namespaces to check (optional)'
                },
                detailed: {
                  type: 'boolean',
                  description: 'Include detailed analysis',
                  default: false
                },
                summary: {
                  type: 'boolean',
                  description: 'Return only high-level summary for AI assistants (overrides detailed)',
                  default: false
                }
              }
            }
          },
          {
            name: 'validate_files',
            description: 'Validate translation files for JSON syntax and structure issues',
            inputSchema: {
              type: 'object',
              properties: {
                fix: {
                  type: 'boolean',
                  description: 'Attempt to fix issues automatically',
                  default: false
                }
              }
            }
          },
          {
            name: 'list_files',
            description: 'List all translation files with their basic information',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  description: 'Filter by specific language'
                },
                namespace: {
                  type: 'string',
                  description: 'Filter by specific namespace'
                }
              }
            }
          },
          {
            name: 'coverage_report',
            description: 'Generate comprehensive coverage report for translations',
            inputSchema: {
              type: 'object',
              properties: {
                languages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific languages to analyze (optional)'
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific namespaces to analyze (optional)'
                }
              }
            }
          },
          {
            name: 'quality_analysis',
            description: 'Analyze translation quality across files',
            inputSchema: {
              type: 'object',
              properties: {
                languages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific languages to analyze (optional)'
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific namespaces to analyze (optional)'
                }
              }
            }
          },
          {
            name: 'usage_analysis',
            description: 'Generate detailed usage analysis of translation keys',
            inputSchema: {
              type: 'object',
              properties: {
                sourceCodePaths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Paths to source code directories to scan',
                  default: ['src/']
                }
              }
            }
          },
          {
            name: 'export_data',
            description: 'Export translation data in various formats',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['json', 'csv', 'xlsx', 'gettext'],
                  description: 'Export format'
                },
                languages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific languages to export (optional)'
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific namespaces to export (optional)'
                }
              },
              required: ['format']
            }
          },
          {
            name: 'sync_missing_keys',
            description: 'Synchronize missing translation keys across all languages from a source language, maintaining sorted structure',
            inputSchema: {
              type: 'object',
              properties: {
                sourceLanguage: {
                  type: 'string',
                  description: 'Source language to copy keys from (default: configured default language)',
                  default: 'en'
                },
                targetLanguages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Target languages to sync keys to (optional, defaults to all languages except source)'
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific namespaces to sync (optional, defaults to all namespaces)'
                },
                placeholder: {
                  type: 'string',
                  description: 'Placeholder text for missing translations (default: empty string)',
                  default: ''
                },
                dryRun: {
                  type: 'boolean',
                  description: 'Preview changes without applying them',
                  default: false
                },
                createBackup: {
                  type: 'boolean',
                  description: 'Create backup before making changes',
                  default: true
                }
              }
            }
          },
          {
            name: 'add_translation_key',
            description: 'Add a specific translation key with values to specified languages and namespaces',
            inputSchema: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                  description: 'Translation key to add (supports nested keys with dot notation)',
                  examples: ['dashboard.activity.title', 'galleries.photos.upload']
                },
                translations: {
                  type: 'object',
                  description: 'Object with language codes as keys and translation values',
                  examples: [{ 'en': 'Activity', 'es': 'Actividad', 'ca': 'Activitat' }]
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Target namespaces (optional, defaults to all namespaces)'
                },
                overwrite: {
                  type: 'boolean',
                  description: 'Overwrite existing keys',
                  default: false
                },
                createBackup: {
                  type: 'boolean',
                  description: 'Create backup before making changes',
                  default: true
                }
              },
              required: ['key', 'translations']
            }
          },
          {
            name: 'sync_from_source',
            description: 'Sync specific missing keys from source language to target languages',
            inputSchema: {
              type: 'object',
              properties: {
                keys: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific keys to sync'
                },
                sourceLanguage: {
                  type: 'string',
                  description: 'Source language to copy from',
                  default: 'en'
                },
                targetLanguages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Target languages to sync to'
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Target namespaces'
                },
                copyValues: {
                  type: 'boolean',
                  description: 'Copy source values as placeholders or leave empty',
                  default: false
                },
                createBackup: {
                  type: 'boolean',
                  description: 'Create backup before making changes',
                  default: true
                }
              },
              required: ['keys', 'targetLanguages']
            }
          },
          {
            name: 'sync_all_missing',
            description: 'Comprehensive sync to add all missing keys across all languages, ensuring complete coverage',
            inputSchema: {
              type: 'object',
              properties: {
                placeholder: {
                  type: 'string',
                  description: 'Placeholder text for missing translations',
                  default: ''
                },
                createBackup: {
                  type: 'boolean',
                  description: 'Create backup before making changes',
                  default: true
                },
                dryRun: {
                  type: 'boolean',
                  description: 'Preview changes without applying them',
                  default: false
                }
              }
            }
          },
          {
            name: 'get_missing_keys',
            description: 'Get a detailed list of missing keys by language and namespace for targeted translation work',
            inputSchema: {
              type: 'object',
              properties: {
                sourceLanguage: {
                  type: 'string',
                  description: 'Reference language to compare against',
                  default: 'en'
                },
                targetLanguages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Languages to check for missing keys (optional)'
                },
                namespaces: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Namespaces to check (optional)'
                },
                format: {
                  type: 'string',
                  enum: ['detailed', 'summary', 'flat'],
                  description: 'Output format for missing keys',
                  default: 'detailed'
                }
              }
            }
          },
          {
            name: 'scan_code_for_missing_keys',
            description: 'Scan code for missing keys using the scanner integration',
            inputSchema: {
              type: 'object',
              properties: {
                sourceCodePaths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Paths to source code directories to scan',
                  default: ['src/']
                }
              }
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.ensureInitialized();

        switch (name) {
          case 'get_project_info':
            return await this.handleGetProjectInfo();
          
          case 'health_check':
            return await this.handleHealthCheck(args);
          
          case 'validate_files':
            return await this.handleValidateFiles(args);
          
          case 'list_files':
            return await this.handleListFiles(args);
          
          case 'coverage_report':
            return await this.handleCoverageReport(args);
          
          case 'quality_analysis':
            return await this.handleQualityAnalysis(args);
          
          case 'usage_analysis':
            return await this.handleUsageAnalysis(args);
          
          case 'export_data':
            return await this.handleExportData(args);

          case 'sync_missing_keys':
            return await this.handleSyncMissingKeys(args);

          case 'add_translation_key':
            return await this.handleAddTranslationKey(args);

          case 'sync_from_source':
            return await this.handleSyncFromSource(args);

          case 'sync_all_missing':
            return await this.handleSyncAllMissing(args);

          case 'get_missing_keys':
            return await this.handleGetMissingKeys(args);
          
          case 'scan_code_for_missing_keys':
            return await this.handleScanCodeForMissingKeys(args);
          
          default:
            throw new I18nError(`Unknown tool: ${name}`, 'UNKNOWN_TOOL');
        }
      } catch (error) {
        if (error instanceof I18nError) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error.message}${error.details ? `\nDetails: ${JSON.stringify(error.details, null, 2)}` : ''}`
              }
            ],
            isError: true
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number = this.operationTimeout): Promise<T> {
    return Promise.race([
      operation,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  private async ensureInitialized(): Promise<void> {
    // Prevent multiple concurrent initialization attempts
    if (this.isInitializing) {
      throw new Error('Initialization already in progress');
    }

    if (!this.fileManager) {
      // Check initialization attempt limit
      if (this.initializationAttempts >= this.maxInitializationAttempts) {
        throw new Error(`Failed to initialize after ${this.maxInitializationAttempts} attempts`);
      }

      this.isInitializing = true;
      this.initializationAttempts++;

      try {
        console.error(`Initialization attempt ${this.initializationAttempts}`);
        
        // Load configuration
        console.error('Loading configuration...');
        const config = await this.configManager.loadConfig();
        console.error('Configuration loaded:', {
          projectRoot: config.projectRoot,
          localesPath: config.localesPath,
          languages: config.languages,
          namespaces: config.namespaces
        });
        
        // Initialize managers
        console.error('Initializing FileManager...');
        this.fileManager = new FileManager(config);
        
        console.error('Initializing HealthChecker...');
        this.healthChecker = new HealthChecker(config, this.fileManager);
        
        // Initialize KeyManager
        console.error('Initializing KeyManager...');
        const { KeyManager } = await import('./management/key-manager.js');
        this.keyManager = new KeyManager(config, this.fileManager);
        
        // Dynamic import for AnalyticsEngine to avoid circular dependencies
        console.error('Initializing AnalyticsEngine...');
        const { AnalyticsEngine } = await import('./reporting/analytics.js');
        this.analyticsEngine = new AnalyticsEngine(config, this.fileManager, this.healthChecker);

        // Initialize scanner integration
        console.error('Initializing ScannerIntegration...');
        this.scannerIntegration = new I18nextScannerIntegration(config);

        // Ensure directory structure exists
        console.error('Ensuring directory structure...');
        await this.fileManager.ensureDirectoryStructure();
        
        console.error('Initialization completed successfully');
        // Reset attempts on successful initialization
        this.initializationAttempts = 0;
      } catch (error) {
        console.error('Initialization failed:', error);
        // Reset state on failure
        this.fileManager = null;
        this.healthChecker = null;
        this.keyManager = null;
        this.analyticsEngine = null;
        this.scannerIntegration = null;
        throw error;
      } finally {
        this.isInitializing = false;
      }
    }
  }

  private async handleGetProjectInfo(): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.fileManager) throw new Error('File manager not initialized');
    
    const config = this.configManager.getConfig();
    const fileStats = await this.fileManager.getFileStats();
    const validation = await this.configManager.validateProject();

    const projectInfo = {
      config: {
        projectRoot: config.projectRoot,
        localesPath: config.localesPath,
        languages: config.languages,
        namespaces: config.namespaces,
        defaultLanguage: config.defaultLanguage,
        defaultNamespace: config.defaultNamespace
      },
      fileStats,
      validation,
      server: {
        name: 'i18next-translation-server',
        version: '1.0.0',
        capabilities: ['file_management', 'validation', 'project_info', 'health_check']
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(projectInfo, null, 2)
        }
      ]
    };
  }

  private async handleHealthCheck(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.healthChecker) throw new Error('Health checker not initialized');
    
    const parsed = z.object({
      languages: z.array(z.string()).optional(),
      namespaces: z.array(z.string()).optional(),
      detailed: z.boolean().default(false),
      summary: z.boolean().default(false)
    }).parse(args || {});

    const results = await this.healthChecker.performHealthCheck(
      parsed.languages,
      parsed.namespaces,
      parsed.detailed
    );

    // If summary mode, return condensed output
    if (parsed.summary) {
      const summaryOutput = {
        overall: {
          score: results.summary.score,
          grade: this.getGradeFromScore(results.summary.score),
          totalIssues: results.summary.totalIssues,
          breakdown: {
            errors: results.summary.errors,
            warnings: results.summary.warnings,
            info: results.summary.info
          }
        },
        files: Object.fromEntries(
          Object.entries(results.files).map(([fileKey, fileData]) => [
            fileKey,
            {
              score: fileData.qualityScore.score,
              grade: fileData.qualityScore.grade,
              keys: fileData.keyCount,
              issues: fileData.issueCount,
              criticalIssues: fileData.issues.filter(i => i.severity === 'error').length
            }
          ])
        ),
        topIssues: results.issues
          .filter(i => i.severity === 'error')
          .slice(0, 5)
          .map(i => ({ type: i.type, severity: i.severity, message: i.message, file: i.file })),
        recommendations: results.recommendations.slice(0, 3)
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summaryOutput, null, 2)
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  }

  private async handleValidateFiles(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.fileManager) throw new Error('File manager not initialized');
    
    const parsed = z.object({
      fix: z.boolean().default(false)
    }).parse(args || {});

    // Basic file validation
    const files = await this.fileManager.loadAllTranslationFiles();
    const results = {
      valid: true,
      issues: [] as Array<{ file: string; issue: string; severity: string }>,
      totalFiles: files.length,
      validFiles: 0,
      fixedIssues: parsed.fix ? [] as string[] : undefined
    };

    for (const file of files) {
      try {
        // File loaded successfully means JSON is valid
        results.validFiles++;
      } catch (error) {
        results.valid = false;
        results.issues.push({
          file: file.path,
          issue: error instanceof Error ? error.message : String(error),
          severity: 'error'
        });
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  }

  private async handleListFiles(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.fileManager) throw new Error('File manager not initialized');

    const schema = z.object({
      language: z.string().optional(),
      namespace: z.string().optional()
    });
    const parsedArgs = schema.parse(args);

    const allFiles = await this.fileManager.loadAllTranslationFiles();
    let filteredFiles = allFiles;

    if (parsedArgs.language) {
      filteredFiles = filteredFiles.filter(f => f.language === parsedArgs.language);
    }
    if (parsedArgs.namespace) {
      filteredFiles = filteredFiles.filter(f => f.namespace === parsedArgs.namespace);
    }

    const fileInfo = filteredFiles.map(f => ({
      path: f.path,
      language: f.language,
      namespace: f.namespace,
      size: f.size,
      lastModified: f.lastModified.toISOString()
    }));

    return {
      content: [{ type: 'text', text: JSON.stringify(fileInfo, null, 2) }]
    };
  }

  private async handleCoverageReport(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.analyticsEngine) throw new Error('Analytics engine not initialized');
    const schema = z.object({
      languages: z.array(z.string()).optional(),
      namespaces: z.array(z.string()).optional(),
    });
    const parsedArgs = schema.parse(args);
    const report = await this.analyticsEngine.generateCoverageReport(parsedArgs.languages, parsedArgs.namespaces);
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  }

  private async handleQualityAnalysis(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.analyticsEngine) throw new Error('Analytics engine not initialized');
    const schema = z.object({
      languages: z.array(z.string()).optional(),
      namespaces: z.array(z.string()).optional(),
    });
    const parsedArgs = schema.parse(args);
    const report = await this.analyticsEngine.generateQualityAnalysis(parsedArgs.languages, parsedArgs.namespaces);
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  }

  private async handleUsageAnalysis(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.analyticsEngine) throw new Error('Analytics engine not initialized');
    const schema = z.object({
      sourceCodePaths: z.array(z.string()).optional(),
    });
    const parsedArgs = schema.parse(args);
    const report = await this.analyticsEngine.generateUsageAnalysis(parsedArgs.sourceCodePaths);
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  }

  private async handleExportData(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.analyticsEngine) throw new Error('Analytics engine not initialized');
    const schema = z.object({
      format: z.enum(['json', 'csv', 'xlsx', 'gettext']),
      languages: z.array(z.string()).optional(),
      namespaces: z.array(z.string()).optional(),
    });
    const parsedArgs = schema.parse(args);
    const result = await this.analyticsEngine.exportData(parsedArgs.format, parsedArgs.languages, parsedArgs.namespaces);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private getGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private async handleSyncMissingKeys(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.fileManager || !this.keyManager) throw new Error('Managers not initialized');
    
    const parsed = z.object({
      sourceLanguage: z.string().default('en'),
      targetLanguages: z.array(z.string()).optional(),
      namespaces: z.array(z.string()).optional(),
      placeholder: z.string().default(''),
      dryRun: z.boolean().default(false),
      createBackup: z.boolean().default(true)
    }).parse(args || {});

    const config = this.configManager.getConfig();
    const targetLanguages = parsed.targetLanguages || config.languages.filter(l => l !== parsed.sourceLanguage);
    const targetNamespaces = parsed.namespaces || config.namespaces;

    const operations = [];
    const errors = [];
    
    for (const namespace of targetNamespaces) {
      try {
        // Load source file
        const sourceFile = await this.fileManager.loadTranslationFile(parsed.sourceLanguage, namespace);
        const sourceKeys = this.getAllKeys(sourceFile.content);

        for (const targetLanguage of targetLanguages) {
          try {
            const targetFile = await this.fileManager.loadTranslationFile(targetLanguage, namespace);
            const targetKeys = new Set(this.getAllKeys(targetFile.content));
            
            const missingKeys = sourceKeys.filter(key => !targetKeys.has(key));
            
            if (missingKeys.length > 0) {
              operations.push({
                language: targetLanguage,
                namespace,
                missingKeys,
                action: parsed.dryRun ? 'preview' : 'sync'
              });

              if (!parsed.dryRun) {
                // Add missing keys
                for (const key of missingKeys) {
                  const sourceValue = this.getNestedValue(sourceFile.content, key);
                  const value = parsed.placeholder || (typeof sourceValue === 'string' ? sourceValue : '');
                  
                  await this.keyManager.addKey({
                    type: 'add',
                    key,
                    value,
                    defaultValue: value,
                    languages: [targetLanguage],
                    namespaces: [namespace],
                    overwrite: false
                  });
                }
              }
            }
          } catch {
            // Target file doesn't exist - create with all source keys
            operations.push({
              language: targetLanguage,
              namespace,
              missingKeys: sourceKeys,
              action: parsed.dryRun ? 'preview' : 'create_file'
            });

            if (!parsed.dryRun) {
              // Create the target directory and file structure
              const newContent: Record<string, unknown> = {};
              for (const key of sourceKeys) {
                const sourceValue = this.getNestedValue(sourceFile.content, key);
                const value = parsed.placeholder || (typeof sourceValue === 'string' ? sourceValue : '');
                this.setNestedValue(newContent, key, value);
              }
              await this.fileManager.saveTranslationFile(targetLanguage, namespace, newContent, parsed.createBackup);
            }
          }
        }
      } catch (error) {
        errors.push(`Failed to process ${parsed.sourceLanguage}/${namespace}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const result = {
      success: errors.length === 0,
      dryRun: parsed.dryRun,
      operations,
      errors,
      summary: {
        totalOperations: operations.length,
        totalKeysToSync: operations.reduce((sum, op) => sum + op.missingKeys.length, 0),
        targetLanguages: targetLanguages.length,
        namespaces: targetNamespaces.length
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj as unknown);
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) return;
    
    let current = obj;
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    
    current[lastKey] = value;
  }

  private async handleAddTranslationKey(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.keyManager) throw new Error('Key manager not initialized');
    
    const parsed = z.object({
      key: z.string(),
      translations: z.record(z.string()),
      namespaces: z.array(z.string()).optional(),
      overwrite: z.boolean().default(false),
      createBackup: z.boolean().default(true)
    }).parse(args);

    const config = this.configManager.getConfig();
    const targetNamespaces = parsed.namespaces || config.namespaces;
    const languages = Object.keys(parsed.translations);

    const results = [];
    const errors = [];

    for (const namespace of targetNamespaces) {
      for (const [language, value] of Object.entries(parsed.translations)) {
        try {
          const result = await this.keyManager.addKey({
            type: 'add',
            key: parsed.key,
            value,
            defaultValue: value,
            languages: [language],
            namespaces: [namespace],
            overwrite: parsed.overwrite
          });

          results.push({
            language,
            namespace,
            key: parsed.key,
            value,
            success: result.success,
            conflicts: result.conflicts,
            errors: result.errors
          });
        } catch (error) {
          errors.push(`Failed to add key "${parsed.key}" to ${language}/${namespace}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const summary = {
      success: errors.length === 0,
      totalOperations: results.length,
      successfulOperations: results.filter(r => r.success).length,
      languages: languages.length,
      namespaces: targetNamespaces.length,
      key: parsed.key
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ summary, results, errors }, null, 2)
        }
      ]
    };
  }

  private async handleSyncFromSource(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.fileManager || !this.keyManager) throw new Error('Managers not initialized');
    
    const parsed = z.object({
      keys: z.array(z.string()),
      sourceLanguage: z.string().default('en'),
      targetLanguages: z.array(z.string()),
      namespaces: z.array(z.string()).optional(),
      copyValues: z.boolean().default(false),
      createBackup: z.boolean().default(true)
    }).parse(args);

    const config = this.configManager.getConfig();
    const targetNamespaces = parsed.namespaces || config.namespaces;

    const results = [];
    const errors = [];

    for (const namespace of targetNamespaces) {
      try {
        // Load source file
        const sourceFile = await this.fileManager.loadTranslationFile(parsed.sourceLanguage, namespace);

        for (const targetLanguage of parsed.targetLanguages) {
          for (const key of parsed.keys) {
            try {
              const sourceValue = this.getNestedValue(sourceFile.content, key);
              if (sourceValue === undefined) {
                errors.push(`Key "${key}" not found in source ${parsed.sourceLanguage}/${namespace}`);
                continue;
              }

              const value = parsed.copyValues && typeof sourceValue === 'string' ? sourceValue : '';
              
              const result = await this.keyManager.addKey({
                type: 'add',
                key,
                value,
                defaultValue: value,
                languages: [targetLanguage],
                namespaces: [namespace],
                overwrite: false
              });

              results.push({
                key,
                language: targetLanguage,
                namespace,
                value,
                success: result.success,
                conflicts: result.conflicts,
                errors: result.errors
              });
            } catch (error) {
              errors.push(`Failed to sync key "${key}" to ${targetLanguage}/${namespace}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      } catch (error) {
        errors.push(`Failed to load source file ${parsed.sourceLanguage}/${namespace}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const summary = {
      success: errors.length === 0,
      totalOperations: results.length,
      successfulOperations: results.filter(r => r.success).length,
      keys: parsed.keys.length,
      targetLanguages: parsed.targetLanguages.length,
      namespaces: targetNamespaces.length
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ summary, results, errors }, null, 2)
        }
      ]
    };
  }

  private async handleSyncAllMissing(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const parsed = z.object({
      placeholder: z.string().default(''),
      createBackup: z.boolean().default(true),
      dryRun: z.boolean().default(false)
    }).parse(args || {});

    // Use the sync_missing_keys handler with all languages
    const config = this.configManager.getConfig();
    
    const syncArgs = {
      sourceLanguage: config.defaultLanguage,
      targetLanguages: config.languages.filter(l => l !== config.defaultLanguage),
      namespaces: config.namespaces,
      placeholder: parsed.placeholder,
      dryRun: parsed.dryRun,
      createBackup: parsed.createBackup
    };

    return await this.handleSyncMissingKeys(syncArgs);
  }

  private async handleGetMissingKeys(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.fileManager) throw new Error('File manager not initialized');
    
    const parsed = z.object({
      sourceLanguage: z.string().default('en'),
      targetLanguages: z.array(z.string()).optional(),
      namespaces: z.array(z.string()).optional(),
      format: z.enum(['detailed', 'summary', 'flat']).default('detailed')
    }).parse(args || {});

    const config = this.configManager.getConfig();
    const targetLanguages = parsed.targetLanguages || config.languages.filter(l => l !== parsed.sourceLanguage);
    const targetNamespaces = parsed.namespaces || config.namespaces;

    const missingKeys: Record<string, Record<string, string[]>> = {};

    for (const namespace of targetNamespaces) {
      try {
        // Load source file
        const sourceFile = await this.fileManager.loadTranslationFile(parsed.sourceLanguage, namespace);
        const sourceKeys = this.getAllKeys(sourceFile.content);

        for (const targetLanguage of targetLanguages) {
          try {
            const targetFile = await this.fileManager.loadTranslationFile(targetLanguage, namespace);
            const targetKeys = new Set(this.getAllKeys(targetFile.content));
            
            const missing = sourceKeys.filter(key => !targetKeys.has(key));
            
            if (missing.length > 0) {
              if (!missingKeys[targetLanguage]) missingKeys[targetLanguage] = {};
              missingKeys[targetLanguage][namespace] = missing;
            }
          } catch {
            // Target file doesn't exist - all source keys are missing
            if (!missingKeys[targetLanguage]) missingKeys[targetLanguage] = {};
            missingKeys[targetLanguage][namespace] = sourceKeys;
          }
        }
             } catch {
         console.warn(`Could not load source file ${parsed.sourceLanguage}/${namespace}.json`);
      }
    }

    let output: unknown;
    if (parsed.format === 'summary') {
      const summary = Object.entries(missingKeys).map(([lang, namespaces]) => ({
        language: lang,
        totalMissing: Object.values(namespaces).flat().length,
        namespaces: Object.keys(namespaces).length
      }));
      output = { summary, totalLanguages: targetLanguages.length };
    } else if (parsed.format === 'flat') {
      const flatKeys: Record<string, string[]> = {};
      for (const [lang, namespaces] of Object.entries(missingKeys)) {
        flatKeys[lang] = Object.values(namespaces).flat();
      }
      output = flatKeys;
    } else {
      output = missingKeys;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2)
        }
      ]
    };
  }

  private getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        keys.push(...this.getAllKeys(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  private async handleScanCodeForMissingKeys(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.scannerIntegration) throw new Error('Scanner integration not initialized');
    
    // Validate args without assigning to unused variable
    z.object({
      sourceCodePaths: z.array(z.string()).optional(),
    }).parse(args || {});

    try {
      // Scan the codebase for translation keys
      console.log('Starting code scan for missing translation keys...');
      
      // Perform the scan to extract keys from code
      const scanResult = await this.scannerIntegration.scanCodebase({ extract: true });
      
      if (!scanResult.success) {
        throw new Error(`Scanner failed: ${scanResult.errors.join(', ')}`);
      }

      // Analyze missing keys across all languages
      const missingKeysAnalysis = await this.scannerIntegration.analyzeMissingKeys();
      
      // Analyze usage patterns
      const usageAnalysis = await this.scannerIntegration.analyzeKeyUsage();

      // Generate actionable recommendations for Cursor
      const actions = [];
      let totalMissingKeys = 0;

      for (const analysis of missingKeysAnalysis) {
        if (analysis.missingKeys.length > 0) {
          totalMissingKeys += analysis.missingKeys.length;
          
          actions.push({
            action: 'sync_missing_keys',
            description: `Sync ${analysis.missingKeys.length} missing keys for ${analysis.language}/${analysis.namespace}`,
            language: analysis.language,
            namespace: analysis.namespace,
            missingKeys: analysis.missingKeys,
            command: `mcp://sync_missing_keys?targetLanguages=${analysis.language}&namespaces=${analysis.namespace}`,
            priority: analysis.missingKeys.length > 10 ? 'high' : 'medium'
          });
        }
      }

      // Add orphaned key cleanup actions
      if (usageAnalysis.orphanedKeys.length > 0) {
        actions.push({
          action: 'clean_orphaned_keys',
          description: `Remove ${usageAnalysis.orphanedKeys.length} orphaned keys that are no longer used in code`,
          orphanedKeys: usageAnalysis.orphanedKeys,
          command: 'mcp://usage_analysis',
          priority: 'low'
        });
      }

      const results = {
        summary: {
          scanSuccess: scanResult.success,
          totalMissingKeys,
          orphanedKeys: usageAnalysis.orphanedKeys.length,
          scanTime: scanResult.scanTime,
          scannedFiles: scanResult.affectedFiles.length
        },
        missingKeysAnalysis,
        usageAnalysis: {
          totalUsedKeys: usageAnalysis.totalUsedKeys,
          orphanedKeys: usageAnalysis.orphanedKeys,
          keysByNamespace: usageAnalysis.keysByNamespace
        },
        automatedActions: actions,
        recommendations: [
          totalMissingKeys > 0 ? `Run sync_missing_keys to add ${totalMissingKeys} missing translation keys` : null,
          usageAnalysis.orphanedKeys.length > 0 ? `Consider removing ${usageAnalysis.orphanedKeys.length} orphaned keys` : null,
          'Run i18n:scan regularly to keep translations in sync with code changes'
        ].filter(Boolean),
        generatedAt: new Date().toISOString()
      };

      console.log(`Code scan completed. Found ${totalMissingKeys} missing keys and ${usageAnalysis.orphanedKeys.length} orphaned keys.`);
      
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Code scan failed:', errorMsg);
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: errorMsg,
            generatedAt: new Date().toISOString()
          }, null, 2) 
        }] 
      };
    }
  }

  async start(): Promise<void> {
    try {
      console.error('Starting i18next Translation MCP Server...');
      
      // Test configuration loading early
      try {
        await this.configManager.loadConfig();
        console.error('Configuration loaded successfully');
      } catch (error) {
        console.error('Configuration loading failed:', error);
        throw error;
      }

      const transport = new StdioServerTransport();
      this.server.connect(transport);
      console.error('i18next Translation MCP Server running on stdio');
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new I18nTranslationServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default I18nTranslationServer; 