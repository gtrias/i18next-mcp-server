import type { 
  I18nConfig, 
  TranslationFile, 
  KeyOperation, 
  KeyAddition, 
  KeyRemoval, 
  KeyRename, 
  BatchKeyOperation,
  KeyConflict,
  OperationResult
} from '../types/index.js';
import type { FileManager } from '../core/file-manager.js';

export class KeyManager {
  constructor(
    private config: I18nConfig,
    private fileManager: FileManager
  ) {}

  /**
   * Add a new translation key to specified languages and namespaces
   */
  async addKey(operation: KeyAddition): Promise<OperationResult> {
    const results: OperationResult = {
      success: true,
      operations: [],
      conflicts: [],
      errors: []
    };

    const targetLanguages = operation.languages || this.config.languages;
    const targetNamespaces = operation.namespaces || this.config.namespaces;

    // Check for existing keys first
    const conflicts = await this.checkKeyConflicts(operation.key, targetLanguages, targetNamespaces);
    if (conflicts.length > 0 && !operation.overwrite) {
      results.success = false;
      results.conflicts = conflicts;
      return results;
    }

    // Add key to each target language/namespace combination
    for (const language of targetLanguages) {
      for (const namespace of targetNamespaces) {
        try {
          const fileKey = `${language}/${namespace}`;
                     const translationFile = await this.fileManager.loadTranslationFile(language, namespace);
           
           const updated = this.setNestedValue(
             translationFile.content,
             operation.key,
             operation.value || (language === this.config.defaultLanguage ? operation.defaultValue : '')
           );

           await this.fileManager.saveTranslationFile(language, namespace, updated);

          results.operations.push({
            type: 'add',
            key: operation.key,
            language,
            namespace,
            value: operation.value || operation.defaultValue,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          results.errors.push(`Failed to add key "${operation.key}" to ${language}/${namespace}: ${error}`);
          results.success = false;
        }
      }
    }

    return results;
  }

  /**
   * Remove a translation key from specified languages and namespaces
   */
  async removeKey(operation: KeyRemoval): Promise<OperationResult> {
    const results: OperationResult = {
      success: true,
      operations: [],
      conflicts: [],
      errors: []
    };

    const targetLanguages = operation.languages || this.config.languages;
    const targetNamespaces = operation.namespaces || this.config.namespaces;

    for (const language of targetLanguages) {
      for (const namespace of targetNamespaces) {
        try {
          const fileKey = `${language}/${namespace}`;
                     const translationFile = await this.fileManager.loadTranslationFile(language, namespace);
           
           const updated = this.deleteNestedValue(translationFile.content, operation.key);
           
           await this.fileManager.saveTranslationFile(language, namespace, updated);

          results.operations.push({
            type: 'remove',
            key: operation.key,
            language,
            namespace,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          results.errors.push(`Failed to remove key "${operation.key}" from ${language}/${namespace}: ${error}`);
          results.success = false;
        }
      }
    }

    return results;
  }

  /**
   * Rename a translation key across specified languages and namespaces
   */
  async renameKey(operation: KeyRename): Promise<OperationResult> {
    const results: OperationResult = {
      success: true,
      operations: [],
      conflicts: [],
      errors: []
    };

    const targetLanguages = operation.languages || this.config.languages;
    const targetNamespaces = operation.namespaces || this.config.namespaces;

    // Check for conflicts with the new key name
    const conflicts = await this.checkKeyConflicts(operation.newKey, targetLanguages, targetNamespaces);
    if (conflicts.length > 0 && !operation.overwrite) {
      results.success = false;
      results.conflicts = conflicts;
      return results;
    }

    for (const language of targetLanguages) {
      for (const namespace of targetNamespaces) {
        try {
          const translationFile = await this.fileManager.loadTranslationFile(language, namespace);

          // Get the existing value
          const existingValue = this.getNestedValue(translationFile.content, operation.oldKey);
          if (existingValue === undefined) {
            results.errors.push(`Key "${operation.oldKey}" not found in ${language}/${namespace}`);
            continue;
          }

          // Remove old key and add new key
          let updated = this.deleteNestedValue(translationFile.content, operation.oldKey);
          updated = this.setNestedValue(updated, operation.newKey, existingValue);

          await this.fileManager.saveTranslationFile(language, namespace, updated);

          results.operations.push({
            type: 'rename',
            key: operation.oldKey,
            newKey: operation.newKey,
            language,
            namespace,
            value: existingValue,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          results.errors.push(`Failed to rename key "${operation.oldKey}" to "${operation.newKey}" in ${language}/${namespace}: ${error}`);
          results.success = false;
        }
      }
    }

    return results;
  }

  /**
   * Execute multiple key operations in a batch
   */
  async batchOperation(operations: BatchKeyOperation): Promise<OperationResult> {
    const results: OperationResult = {
      success: true,
      operations: [],
      conflicts: [],
      errors: []
    };

    // Create backup if requested
    if (operations.createBackup) {
      try {
        await this.fileManager.createBackup(`batch-operation-${Date.now()}`);
      } catch (error) {
        results.errors.push(`Failed to create backup: ${error}`);
        if (!operations.continueOnError) {
          results.success = false;
          return results;
        }
      }
    }

    // Execute each operation
    for (const operation of operations.operations) {
      try {
        let operationResult: OperationResult;

                 switch (operation.type) {
           case 'add':
             operationResult = await this.addKey(operation as KeyAddition);
             break;
           case 'remove':
             operationResult = await this.removeKey(operation as KeyRemoval);
             break;
           case 'rename':
             operationResult = await this.renameKey(operation as KeyRename);
             break;
           default:
             throw new Error(`Unknown operation type: ${operation.type}`);
         }

        // Merge results
        results.operations.push(...operationResult.operations);
        results.conflicts.push(...operationResult.conflicts);
        results.errors.push(...operationResult.errors);

        if (!operationResult.success) {
          results.success = false;
          if (!operations.continueOnError) {
            break;
          }
        }

      } catch (error) {
        results.errors.push(`Batch operation failed: ${error}`);
        results.success = false;
        if (!operations.continueOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Sync keys from a source namespace to target namespaces
   */
  async syncKeys(
    sourceNamespace: string,
    targetNamespaces: string[],
    language: string = this.config.defaultLanguage,
    copyValues: boolean = false
  ): Promise<OperationResult> {
    const results: OperationResult = {
      success: true,
      operations: [],
      conflicts: [],
      errors: []
    };

    try {
      // Get source keys
      const sourceFile = await this.fileManager.loadTranslationFile(language, sourceNamespace);
      if (!sourceFile) {
        results.success = false;
        results.errors.push(`Source namespace "${sourceNamespace}" not found`);
        return results;
      }

      const sourceKeys = this.getAllKeys(sourceFile.content);

      // Add missing keys to target namespaces
      for (const targetNamespace of targetNamespaces) {
        const targetFile = await this.fileManager.loadTranslationFile(language, targetNamespace);
        if (!targetFile) {
          results.errors.push(`Target namespace "${targetNamespace}" not found`);
          continue;
        }

        const targetKeys = this.getAllKeys(targetFile.content);
        const missingKeys = sourceKeys.filter(key => !targetKeys.includes(key));

        for (const key of missingKeys) {
          const sourceValue = this.getNestedValue(sourceFile.content, key);
          const valueToSet = copyValues ? sourceValue : '';

          const updated = this.setNestedValue(targetFile.content, key, valueToSet);
          
          await this.fileManager.saveTranslationFile(language, targetNamespace, updated);

          results.operations.push({
            type: 'sync',
            key,
            language,
            namespace: targetNamespace,
            value: valueToSet,
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      results.success = false;
      results.errors.push(`Sync operation failed: ${error}`);
    }

    return results;
  }

  /**
   * Check for key conflicts before operations
   */
  private async checkKeyConflicts(
    key: string,
    languages: string[],
    namespaces: string[]
  ): Promise<KeyConflict[]> {
    const conflicts: KeyConflict[] = [];

    for (const language of languages) {
      for (const namespace of namespaces) {
        try {
          const translationFile = await this.fileManager.loadTranslationFile(language, namespace);
          
          if (translationFile && this.getNestedValue(translationFile.content, key) !== undefined) {
            conflicts.push({
              key,
              language,
              namespace,
              existingValue: this.getNestedValue(translationFile.content, key)
            });
          }
        } catch (error) {
          // Ignore errors for conflict checking
        }
      }
    }

    return conflicts;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return (current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined);
    }, obj as unknown);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const keys = path.split('.');
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone
    
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    
    current[keys[keys.length - 1]] = value;
    return result;
  }

  /**
   * Delete nested value from object using dot notation
   */
  private deleteNestedValue(obj: Record<string, unknown>, path: string): Record<string, unknown> {
    const keys = path.split('.');
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone
    
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        return result; // Path doesn't exist
      }
      current = current[key] as Record<string, unknown>;
    }
    
    delete current[keys[keys.length - 1]];
    
    // Clean up empty parent objects
    this.cleanupEmptyObjects(result, keys.slice(0, -1));
    
    return result;
  }

  /**
   * Remove empty parent objects after deletion
   */
  private cleanupEmptyObjects(obj: Record<string, unknown>, path: string[]): void {
    if (path.length === 0) return;
    
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (typeof current[path[i]] !== 'object') return;
      current = current[path[i]] as Record<string, unknown>;
    }
    
    const target = current[path[path.length - 1]];
    if (typeof target === 'object' && target !== null && Object.keys(target).length === 0) {
      delete current[path[path.length - 1]];
      this.cleanupEmptyObjects(obj, path.slice(0, -1));
    }
  }

  /**
   * Get all keys from a nested object
   */
  private getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        keys.push(...this.getAllKeys(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }
} 