import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';
import type { TranslationFile, I18nConfig } from '../types/index.js';
import { FileSystemError, ValidationError } from '../types/index.js';

export class FileManager {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private cache: Map<string, TranslationFile> = new Map();
  private operationsInProgress: Set<string> = new Set();

  constructor(private config: I18nConfig) {}

  private getOperationKey(language: string, namespace: string): string {
    return `${language}:${namespace}`;
  }

  async loadTranslationFile(language: string, namespace: string): Promise<TranslationFile> {
    const operationKey = this.getOperationKey(language, namespace);
    
    // Prevent concurrent operations on the same file
    if (this.operationsInProgress.has(operationKey)) {
      throw new Error(`Operation already in progress for ${operationKey}`);
    }

    this.operationsInProgress.add(operationKey);

    try {
      const filePath = path.join(this.config.localesPath, language, `${namespace}.json`);
      const cacheKey = `${language}:${namespace}`;

      try {
        const stats = await fs.stat(filePath);
        const cached = this.cache.get(cacheKey);

        // Return cached version if file hasn't been modified
        if (cached && cached.lastModified >= stats.mtime) {
          return cached;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        let parsedContent: Record<string, unknown>;

        try {
          parsedContent = JSON.parse(content);
        } catch (error) {
          throw new ValidationError(`Invalid JSON in ${filePath}`, { error });
        }

        const translationFile: TranslationFile = {
          language,
          namespace,
          path: filePath,
          content: parsedContent,
          lastModified: stats.mtime,
          size: stats.size
        };

        this.cache.set(cacheKey, translationFile);
        return translationFile;
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new FileSystemError(`Failed to load translation file: ${filePath}`, { error });
      }
    } finally {
      this.operationsInProgress.delete(operationKey);
    }
  }

  async saveTranslationFile(
    language: string,
    namespace: string,
    content: Record<string, unknown>,
    createBackup = true
  ): Promise<void> {
    const filePath = path.join(this.config.localesPath, language, `${namespace}.json`);

    try {
      // Create backup if enabled and requested
      if (createBackup && this.config.backup.enabled) {
        await this.createBackup(filePath);
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Sort keys for consistent output
      const sortedContent = this.sortObjectKeys(content);
      const jsonString = `${JSON.stringify(sortedContent, null, 2)}\n`;

      await fs.writeFile(filePath, jsonString, 'utf-8');

      // Update cache
      const stats = await fs.stat(filePath);
      const cacheKey = `${language}:${namespace}`;
      this.cache.set(cacheKey, {
        language,
        namespace,
        path: filePath,
        content: sortedContent,
        lastModified: stats.mtime,
        size: stats.size
      });
    } catch (error) {
      throw new FileSystemError(`Failed to save translation file: ${filePath}`, { error });
    }
  }

  async loadAllTranslationFiles(): Promise<TranslationFile[]> {
    const files: TranslationFile[] = [];

    for (const language of this.config.languages) {
      for (const namespace of this.config.namespaces) {
        try {
          const file = await this.loadTranslationFile(language, namespace);
          files.push(file);
        } catch (error) {
          // Log error but continue loading other files
          console.warn(`Failed to load ${language}/${namespace}.json:`, error);
        }
      }
    }

    return files;
  }

  async createBackup(filePath: string): Promise<string> {
    if (!this.config.backup.enabled) {
      return '';
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const relativePath = path.relative(this.config.localesPath, filePath);
      const backupPath = path.join(this.config.backup.path, timestamp, relativePath);

      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.copyFile(filePath, backupPath);

      return backupPath;
    } catch (error) {
      throw new FileSystemError(`Failed to create backup for ${filePath}`, { error });
    }
  }

  async watchFiles(callback: (event: string, filePath: string) => void): Promise<void> {
    const watchPattern = path.join(this.config.localesPath, '**/*.json');

    const watcher = chokidar.watch(watchPattern, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', (filePath) => {
      this.invalidateCache(filePath);
      callback('change', filePath);
    });

    watcher.on('add', (filePath) => {
      callback('add', filePath);
    });

    watcher.on('unlink', (filePath) => {
      this.invalidateCache(filePath);
      callback('unlink', filePath);
    });

    this.watchers.set(watchPattern, watcher);
  }

  async stopWatching(): Promise<void> {
    for (const [pattern, watcher] of this.watchers) {
      await watcher.close();
      this.watchers.delete(pattern);
    }
  }

  private invalidateCache(filePath: string): void {
    // Find and remove cache entries for the changed file
    for (const [key, cached] of this.cache) {
      if (cached.path === filePath) {
        this.cache.delete(key);
        break;
      }
    }
  }

  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sorted[key] = this.sortObjectKeys(value as Record<string, unknown>);
      } else {
        sorted[key] = value;
      }
    }

    return sorted;
  }

  async ensureDirectoryStructure(): Promise<void> {
    try {
      // Create base locales directory
      await fs.mkdir(this.config.localesPath, { recursive: true });

      // Create language directories
      for (const language of this.config.languages) {
        const langDir = path.join(this.config.localesPath, language);
        await fs.mkdir(langDir, { recursive: true });

        // Create namespace files if they don't exist
        for (const namespace of this.config.namespaces) {
          const filePath = path.join(langDir, `${namespace}.json`);
          try {
            await fs.access(filePath);
          } catch {
            // File doesn't exist, create it with empty object
            await fs.writeFile(filePath, '{}\n', 'utf-8');
          }
        }
      }

      // Create backup directory if enabled
      if (this.config.backup.enabled) {
        await fs.mkdir(this.config.backup.path, { recursive: true });
      }
    } catch (error) {
      throw new FileSystemError('Failed to ensure directory structure', { error });
    }
  }

  async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    lastModified: Date;
    filesByLanguage: Record<string, number>;
    filesByNamespace: Record<string, number>;
  }> {
    const files = await this.loadAllTranslationFiles();
    
    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      lastModified: new Date(Math.max(...files.map(f => f.lastModified.getTime()))),
      filesByLanguage: {} as Record<string, number>,
      filesByNamespace: {} as Record<string, number>
    };

    // Count files by language and namespace
    for (const file of files) {
      stats.filesByLanguage[file.language] = (stats.filesByLanguage[file.language] || 0) + 1;
      stats.filesByNamespace[file.namespace] = (stats.filesByNamespace[file.namespace] || 0) + 1;
    }

    return stats;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
} 