import path from 'node:path';
import fs from 'node:fs/promises';
import type { I18nConfig } from '../types/index.js';
import { I18nConfigSchema, ConfigurationError } from '../types/index.js';

export class ConfigManager {
  private config: I18nConfig | null = null;

  async loadConfig(configPath?: string): Promise<I18nConfig> {
    let config: Partial<I18nConfig> = {};

    // Try to load config file if provided
    if (configPath) {
      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configContent);
      } catch (error) {
        throw new ConfigurationError(`Failed to load config from ${configPath}`, { error });
      }
    }

    // Apply environment variables and defaults
    const fullConfig = {
      projectRoot: process.env.I18N_PROJECT_ROOT || process.cwd(),
      localesPath: process.env.I18N_LOCALES_DIR || process.env.I18N_LOCALES_PATH || config.localesPath || 'public/locales',
      languages: process.env.I18N_LANGUAGES?.split(',') || config.languages || ['en'],
      namespaces: process.env.I18N_NAMESPACES?.split(',') || config.namespaces || ['translation'],
      defaultLanguage: process.env.I18N_DEFAULT_LANGUAGE || config.defaultLanguage || 'en',
      defaultNamespace: config.defaultNamespace || 'translation',
      keySeparator: config.keySeparator || '.',
      nsSeparator: config.nsSeparator || ':',
      interpolation: {
        prefix: config.interpolation?.prefix || '{{',
        suffix: config.interpolation?.suffix || '}}'
      },
      backup: {
        enabled: config.backup?.enabled ?? true,
        path: config.backup?.path || '.backups/i18n'
      }
    };

    // Validate the configuration
    try {
      this.config = I18nConfigSchema.parse(fullConfig);
    } catch (error) {
      throw new ConfigurationError('Invalid configuration', { error });
    }

    // Ensure paths are absolute
    this.config.projectRoot = path.resolve(this.config.projectRoot);
    this.config.localesPath = path.resolve(this.config.projectRoot, this.config.localesPath);
    this.config.backup.path = path.resolve(this.config.projectRoot, this.config.backup.path);

    // Check if the locales directory exists, create it if it doesn't
    try {
      await fs.access(this.config.localesPath);
    } catch {
      console.warn(`⚠️  Locales directory not found: ${this.config.localesPath}`);
      console.warn(`   The directory will be created when needed.`);
      console.warn(`   You can specify a different path using I18N_LOCALES_DIR environment variable.`);
    }

    return this.config;
  }

  getConfig(): I18nConfig {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  getAbsoluteLocalesPath(): string {
    return this.getConfig().localesPath;
  }

  getLanguageFilePath(language: string, namespace: string): string {
    const config = this.getConfig();
    return path.join(config.localesPath, language, `${namespace}.json`);
  }

  getAllLanguageFiles(): Array<{ language: string; namespace: string; path: string }> {
    const config = this.getConfig();
    const files: Array<{ language: string; namespace: string; path: string }> = [];

    for (const language of config.languages) {
      for (const namespace of config.namespaces) {
        files.push({
          language,
          namespace,
          path: this.getLanguageFilePath(language, namespace)
        });
      }
    }

    return files;
  }

  isValidLanguage(language: string): boolean {
    return this.getConfig().languages.includes(language);
  }

  isValidNamespace(namespace: string): boolean {
    return this.getConfig().namespaces.includes(namespace);
  }

  async createBackupPath(): Promise<string> {
    const config = this.getConfig();
    if (!config.backup.enabled) {
      throw new ConfigurationError('Backup is disabled in configuration');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(config.backup.path, timestamp);

    try {
      await fs.mkdir(backupDir, { recursive: true });
      return backupDir;
    } catch (error) {
      throw new ConfigurationError(`Failed to create backup directory: ${backupDir}`, { error });
    }
  }

  async validateProject(): Promise<{ valid: boolean; issues: string[] }> {
    const config = this.getConfig();
    const issues: string[] = [];

    // Check if project root exists
    try {
      await fs.access(config.projectRoot);
    } catch {
      issues.push(`Project root does not exist: ${config.projectRoot}`);
    }

    // Check if locales directory exists
    try {
      await fs.access(config.localesPath);
    } catch {
      issues.push(`Locales directory does not exist: ${config.localesPath}`);
    }

    // Check if language directories exist
    for (const language of config.languages) {
      const langDir = path.join(config.localesPath, language);
      try {
        await fs.access(langDir);
      } catch {
        issues.push(`Language directory does not exist: ${langDir}`);
      }
    }

    // Check for required namespace files in default language
    const defaultLangDir = path.join(config.localesPath, config.defaultLanguage);
    for (const namespace of config.namespaces) {
      const filePath = path.join(defaultLangDir, `${namespace}.json`);
      try {
        await fs.access(filePath);
      } catch {
        issues.push(`Required namespace file missing: ${filePath}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
} 