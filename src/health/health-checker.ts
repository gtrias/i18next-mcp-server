import type { I18nConfig, TranslationFile, HealthCheckResult, ValidationIssue, QualityScore } from '../types/index.js';
import type { FileManager } from '../core/file-manager.js';
import { ValidationError } from '../types/index.js';

export class HealthChecker {
  constructor(
    private config: I18nConfig,
    private fileManager: FileManager
  ) {}

  async performHealthCheck(
    languages?: string[],
    namespaces?: string[],
    detailed = false
  ): Promise<HealthCheckResult> {
    const targetLanguages = languages || this.config.languages;
    const targetNamespaces = namespaces || this.config.namespaces;

    const result: HealthCheckResult = {
      summary: {
        totalIssues: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        score: 0
      },
      files: {},
      issues: [],
      recommendations: [],
      timestamp: new Date()
    };

    // Load all translation files
    const translations: Record<string, Record<string, Record<string, unknown>>> = {};
    
    for (const language of targetLanguages) {
      translations[language] = {};
      
      for (const namespace of targetNamespaces) {
        try {
          const file = await this.fileManager.loadTranslationFile(language, namespace);
          translations[language][namespace] = file.content;
        } catch (error) {
          result.issues.push({
            type: 'file_missing',
            severity: 'error',
            message: `Missing translation file: ${language}/${namespace}.json`,
            file: `${language}/${namespace}`,
            suggestion: 'Create the missing translation file',
            location: { language, namespace }
          });
          translations[language][namespace] = {};
        }
      }
    }

    // Perform health checks for each file
    for (const language of targetLanguages) {
      for (const namespace of targetNamespaces) {
        const fileKey = `${language}/${namespace}`;
        const keys = this.getAllKeysWithDetails(translations[language][namespace]);
        const fileIssues: ValidationIssue[] = [];

        // Interpolation validation
        for (const [key, detail] of Object.entries(keys)) {
          const interpolationIssues = this.validateInterpolation(detail.value, key, fileKey);
          fileIssues.push(...interpolationIssues);
        }

        // Pluralization validation
        const pluralizationIssues = this.validatePluralization(keys, namespace, language, fileKey);
        fileIssues.push(...pluralizationIssues);

        // Translation quality validation
        const qualityIssues = this.validateTranslationQuality(keys, language, namespace, fileKey);
        fileIssues.push(...qualityIssues);

        // Consistency validation (compare with source language)
        if (language !== this.config.defaultLanguage) {
          const sourceKeys = this.getAllKeysWithDetails(translations[this.config.defaultLanguage][namespace]);
          const consistencyIssues = this.validateConsistency(
            sourceKeys,
            keys,
            this.config.defaultLanguage,
            language,
            namespace,
            fileKey
          );
          fileIssues.push(...consistencyIssues);
        }

        // Structure validation
        const structureIssues = this.validateStructure(keys, fileKey);
        fileIssues.push(...structureIssues);

        // Performance validation
        const performanceIssues = this.validatePerformance(keys, fileKey);
        fileIssues.push(...performanceIssues);

        result.issues.push(...fileIssues);
        result.files[fileKey] = {
          keyCount: Object.keys(keys).length,
          issueCount: fileIssues.length,
          issues: detailed ? fileIssues : fileIssues.filter(i => i.severity === 'error'),
          qualityScore: this.calculateQualityScore(keys, fileIssues)
        };
      }
    }

    // Cross-language analysis
    const crossLangIssues = this.performCrossLanguageAnalysis(translations, targetLanguages, targetNamespaces);
    result.issues.push(...crossLangIssues);

    // Calculate summary
    for (const issue of result.issues) {
      result.summary.totalIssues++;
      if (issue.severity === 'error') result.summary.errors++;
      else if (issue.severity === 'warning') result.summary.warnings++;
      else if (issue.severity === 'info') result.summary.info++;
    }

    // Calculate overall score
    result.summary.score = this.calculateOverallScore(result);

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);

    return result;
  }

  async performHealthCheckSummary(
    languages?: string[],
    namespaces?: string[]
  ): Promise<{
    overall: {
      score: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      status: 'excellent' | 'good' | 'needs_attention' | 'poor';
      totalIssues: number;
      criticalIssues: number;
    };
    files: Record<string, {
      score: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      keyCount: number;
      issueCount: number;
      status: 'healthy' | 'warning' | 'error';
    }>;
    topIssues: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      count: number;
      description: string;
    }>;
    recommendations: string[];
  }> {
    // Perform lightweight health check
    const fullResult = await this.performHealthCheck(languages, namespaces, false);
    
    // Calculate overall status
    const getStatus = (score: number) => {
      if (score >= 90) return 'excellent';
      if (score >= 80) return 'good';
      if (score >= 60) return 'needs_attention';
      return 'poor';
    };

    const getGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
      if (score >= 90) return 'A';
      if (score >= 80) return 'B';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'F';
    };

    // Group issues by type for summary
    const issueTypeCounts = fullResult.issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topIssueTypes = Object.entries(issueTypeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        severity: fullResult.issues.find(i => i.type === type)?.severity || 'info' as const,
        count,
        description: this.getIssueTypeDescription(type)
      }));

    return {
      overall: {
        score: fullResult.summary.score,
        grade: getGrade(fullResult.summary.score),
        status: getStatus(fullResult.summary.score),
        totalIssues: fullResult.summary.totalIssues,
        criticalIssues: fullResult.summary.errors
      },
      files: Object.fromEntries(
        Object.entries(fullResult.files).map(([fileKey, fileData]) => [
          fileKey,
          {
            score: fileData.qualityScore.score,
            grade: fileData.qualityScore.grade,
            keyCount: fileData.keyCount,
            issueCount: fileData.issueCount,
            status: fileData.issues.some(i => i.severity === 'error') ? 'error' : 
                   fileData.issues.some(i => i.severity === 'warning') ? 'warning' : 'healthy'
          }
        ])
      ),
      topIssues: topIssueTypes,
      recommendations: fullResult.recommendations.slice(0, 3)
    };
  }

  async validateFiles(fix = false): Promise<{
    valid: boolean;
    issues: ValidationIssue[];
    totalFiles: number;
    validFiles: number;
    fixedIssues?: string[];
  }> {
    const files = await this.fileManager.loadAllTranslationFiles();
    const results = {
      valid: true,
      issues: [] as ValidationIssue[],
      totalFiles: files.length,
      validFiles: 0,
      fixedIssues: fix ? [] as string[] : undefined
    };

    for (const file of files) {
      try {
        // Basic JSON validation
        JSON.stringify(file.content); // Will throw if not serializable
        
        // Structure validation
        this.validateJsonStructure(file.content, `${file.language}/${file.namespace}`);
        
        results.validFiles++;
      } catch (error) {
        results.valid = false;
        results.issues.push({
          type: 'json_syntax_error',
          severity: 'error',
          message: `JSON syntax error in ${file.path}`,
          file: `${file.language}/${file.namespace}`,
          suggestion: 'Fix JSON syntax errors',
          location: { language: file.language, namespace: file.namespace },
          details: { error: error instanceof Error ? error.message : String(error) }
        });

        if (fix && results.fixedIssues) {
          try {
            // Attempt basic JSON fixes
            const fixed = this.attemptJsonFix(file.content);
            if (fixed) {
              await this.fileManager.saveTranslationFile(
                file.language,
                file.namespace,
                fixed,
                true
              );
              results.fixedIssues.push(`Fixed JSON in ${file.path}`);
            }
          } catch (fixError) {
            // Fix failed, continue
          }
        }
      }
    }

    return results;
  }

  private getAllKeysWithDetails(obj: Record<string, unknown>, prefix = '', path: string[] = []): Record<string, {
    value: unknown;
    path: string[];
    type: string;
  }> {
    const result: Record<string, { value: unknown; path: string[]; type: string }> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const fullPath = [...path, key];
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.getAllKeysWithDetails(value as Record<string, unknown>, fullKey, fullPath));
      } else {
        result[fullKey] = {
          value,
          path: fullPath,
          type: typeof value
        };
      }
    }
    
    return result;
  }

  private validateInterpolation(
    value: unknown,
    keyPath: string,
    fileKey: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    if (typeof value !== 'string') return issues;
    
    // Check for unbalanced interpolation brackets
    const openBrackets = (value.match(/\{\{/g) || []).length;
    const closeBrackets = (value.match(/\}\}/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
      issues.push({
        type: 'interpolation_unbalanced',
        severity: 'error',
        message: `Unbalanced interpolation brackets in "${keyPath}"`,
        file: fileKey,
        suggestion: 'Ensure all {{variable}} brackets are properly closed',
        location: { key: keyPath },
        details: { value, openCount: openBrackets, closeCount: closeBrackets }
      });
    }
    
    // Check for empty interpolation
    const emptyInterpolation = value.match(/\{\{\s*\}\}/g);
    if (emptyInterpolation) {
      issues.push({
        type: 'interpolation_empty',
        severity: 'warning',
        message: `Empty interpolation in "${keyPath}"`,
        file: fileKey,
        suggestion: 'Remove empty {{}} or add variable name',
        location: { key: keyPath },
        details: { value, emptyCount: emptyInterpolation.length }
      });
    }

    // Check for malformed interpolation
    const malformedInterpolation = value.match(/\{[^{}]*\}[^}]|[^{]\{[^{}]*\}/g);
    if (malformedInterpolation) {
      issues.push({
        type: 'interpolation_malformed',
        severity: 'warning',
        message: `Potentially malformed interpolation in "${keyPath}"`,
        file: fileKey,
        suggestion: 'Use {{variable}} format for interpolation',
        location: { key: keyPath },
        details: { value, matches: malformedInterpolation }
      });
    }
    
    return issues;
  }

  private validatePluralization(
    keys: Record<string, { value: unknown; path: string[]; type: string }>,
    namespace: string,
    lang: string,
    fileKey: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const pluralKeys: Record<string, string[]> = {};
    
    // Group potential plural keys
    for (const key of Object.keys(keys)) {
      const pluralMatch = key.match(/^(.+)_(one|other|zero|two|few|many)$/);
      if (pluralMatch) {
        const baseKey = pluralMatch[1];
        const pluralForm = pluralMatch[2];
        
        if (!pluralKeys[baseKey]) {
          pluralKeys[baseKey] = [];
        }
        pluralKeys[baseKey].push(pluralForm);
      }
    }
    
    // Validate plural forms based on language
    for (const [baseKey, forms] of Object.entries(pluralKeys)) {
      const expectedForms = this.getExpectedPluralForms(lang);
      const missingForms = expectedForms.filter(form => !forms.includes(form));
      
      if (missingForms.length > 0) {
        issues.push({
          type: 'pluralization_missing_forms',
          severity: 'warning',
          message: `${this.getLanguageName(lang)} pluralization incomplete for "${baseKey}" in ${namespace}`,
          file: fileKey,
          suggestion: `${this.getLanguageName(lang)} typically requires: ${expectedForms.join(', ')}`,
          location: { key: baseKey, namespace },
          details: { found: forms, expected: expectedForms, missing: missingForms }
        });
      }
    }
    
    return issues;
  }

  private validateConsistency(
    sourceKeys: Record<string, { value: unknown; path: string[]; type: string }>,
    targetKeys: Record<string, { value: unknown; path: string[]; type: string }>,
    sourceLang: string,
    targetLang: string,
    namespace: string,
    fileKey: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    for (const [key, sourceDetail] of Object.entries(sourceKeys)) {
      const targetDetail = targetKeys[key];
      
      if (!targetDetail) {
        issues.push({
          type: 'consistency_missing_key',
          severity: 'warning',
          message: `Key "${key}" exists in ${sourceLang} but missing in ${targetLang}`,
          file: fileKey,
          suggestion: `Add missing key to ${targetLang}/${namespace}.json`,
          location: { key, namespace },
          details: { sourceValue: sourceDetail.value }
        });
        continue;
      }
      
      const sourceValue = sourceDetail.value;
      const targetValue = targetDetail.value;
      
      if (typeof sourceValue !== typeof targetValue) {
        issues.push({
          type: 'consistency_type_mismatch',
          severity: 'error',
          message: `Type mismatch for "${key}" between ${sourceLang} and ${targetLang}`,
          file: fileKey,
          suggestion: 'Ensure the same type (string, object, etc.) in all languages',
          location: { key, namespace },
          details: { sourceType: typeof sourceValue, targetType: typeof targetValue }
        });
      }
      
      // Check interpolation consistency
      if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
        const sourceVars = this.extractInterpolationVars(sourceValue);
        const targetVars = this.extractInterpolationVars(targetValue);
        
        const missingVars = sourceVars.filter(v => !targetVars.includes(v));
        const extraVars = targetVars.filter(v => !sourceVars.includes(v));
        
        if (missingVars.length > 0 || extraVars.length > 0) {
          issues.push({
            type: 'consistency_interpolation_mismatch',
            severity: 'error',
            message: `Interpolation variables mismatch for "${key}" between ${sourceLang} and ${targetLang}`,
            file: fileKey,
            suggestion: 'Ensure all interpolation variables match between languages',
            location: { key, namespace },
            details: { 
              sourceVars, 
              targetVars, 
              missing: missingVars, 
              extra: extraVars,
              sourceValue,
              targetValue
            }
          });
        }
      }
    }

    // Check for orphaned keys (exist in target but not in source)
    for (const key of Object.keys(targetKeys)) {
      if (!sourceKeys[key]) {
        issues.push({
          type: 'consistency_orphaned_key',
          severity: 'info',
          message: `Key "${key}" exists in ${targetLang} but not in ${sourceLang}`,
          file: fileKey,
          suggestion: `Consider removing orphaned key or adding it to ${sourceLang}`,
          location: { key, namespace },
          details: { targetValue: targetKeys[key].value }
        });
      }
    }
    
    return issues;
  }

  private validateTranslationQuality(
    keys: Record<string, { value: unknown; path: string[]; type: string }>,
    lang: string,
    namespace: string,
    fileKey: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    for (const [key, detail] of Object.entries(keys)) {
      if (typeof detail.value !== 'string') continue;
      
      const value = detail.value as string;
      
      // Check for untranslated content (still in source language)
      if (lang !== this.config.defaultLanguage && this.isUntranslated(value, lang)) {
        issues.push({
          type: 'quality_untranslated',
          severity: 'warning',
          message: `Potentially untranslated content in "${key}"`,
          file: fileKey,
          suggestion: `Translate to ${this.getLanguageName(lang)}`,
          location: { key, namespace },
          details: { value }
        });
      }
      
      // Check for suspicious patterns
      if (this.hasSuspiciousPattern(value)) {
        issues.push({
          type: 'quality_suspicious_content',
          severity: 'info',
          message: `Suspicious content pattern in "${key}"`,
          file: fileKey,
          suggestion: 'Review content for placeholder text or development artifacts',
          location: { key, namespace },
          details: { value }
        });
      }
      
      // Check for HTML content
      if (this.containsHtml(value)) {
        issues.push({
          type: 'quality_html_content',
          severity: 'info',
          message: `HTML content detected in "${key}"`,
          file: fileKey,
          suggestion: 'Ensure HTML is properly sanitized and consider using rich text components',
          location: { key, namespace },
          details: { value }
        });
      }

      // Check for length inconsistencies (extremely long or short translations)
      const lengthIssue = this.validateTranslationLength(value, key);
      if (lengthIssue) {
        issues.push({
          ...lengthIssue,
          file: fileKey,
          location: { key, namespace }
        });
      }
    }
    
    return issues;
  }

  private validateStructure(
    keys: Record<string, { value: unknown; path: string[]; type: string }>,
    fileKey: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Check for deeply nested structures
    for (const [key, detail] of Object.entries(keys)) {
      if (detail.path.length > 5) {
        issues.push({
          type: 'structure_deeply_nested',
          severity: 'info',
          message: `Deeply nested key "${key}" (${detail.path.length} levels)`,
          file: fileKey,
          suggestion: 'Consider flattening deeply nested structures for better maintainability',
          location: { key },
          details: { depth: detail.path.length, path: detail.path }
        });
      }
    }

    // Check for inconsistent naming patterns
    const namingIssues = this.validateNamingPatterns(Object.keys(keys), fileKey);
    issues.push(...namingIssues);
    
    return issues;
  }

  private validatePerformance(
    keys: Record<string, { value: unknown; path: string[]; type: string }>,
    fileKey: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const keyCount = Object.keys(keys).length;
    
    // Check for large namespace files
    if (keyCount > 500) {
      issues.push({
        type: 'performance_large_namespace',
        severity: 'warning',
        message: `Large namespace with ${keyCount} keys`,
        file: fileKey,
        suggestion: 'Consider splitting large namespaces for better performance',
        details: { keyCount }
      });
    }

    // Check for very long translation values
    for (const [key, detail] of Object.entries(keys)) {
      if (typeof detail.value === 'string' && detail.value.length > 1000) {
        issues.push({
          type: 'performance_long_translation',
          severity: 'info',
          message: `Very long translation in "${key}" (${detail.value.length} characters)`,
          file: fileKey,
          suggestion: 'Consider breaking long translations into smaller parts',
          location: { key },
          details: { length: detail.value.length }
        });
      }
    }
    
    return issues;
  }

  private performCrossLanguageAnalysis(
    translations: Record<string, Record<string, Record<string, unknown>>>,
    languages: string[],
    namespaces: string[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Check for missing language files
    for (const namespace of namespaces) {
      const availableLanguages = languages.filter(lang => 
        translations[lang] && translations[lang][namespace]
      );
      
      if (availableLanguages.length < languages.length) {
        const missingLanguages = languages.filter(lang => !availableLanguages.includes(lang));
        
        issues.push({
          type: 'cross_language_missing_files',
          severity: 'error',
          message: `Namespace "${namespace}" missing in languages: ${missingLanguages.join(', ')}`,
          suggestion: 'Create missing translation files',
          details: { 
            namespace, 
            missingLanguages,
            availableLanguages
          }
        });
      }
    }
    
    return issues;
  }

  private calculateQualityScore(
    keys: Record<string, { value: unknown; path: string[]; type: string }>,
    issues: ValidationIssue[]
  ): QualityScore {
    const totalKeys = Object.keys(keys).length;
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    
    // Calculate score out of 100
    let score = 100;
    score -= errors * 10; // Each error -10 points
    score -= warnings * 2; // Each warning -2 points
    
    score = Math.max(0, Math.min(100, score)); // Clamp between 0-100
    
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';
    
    return {
      score,
      grade,
      totalKeys,
      errorCount: errors,
      warningCount: warnings
    };
  }

  private calculateOverallScore(result: HealthCheckResult): number {
    const files = Object.values(result.files);
    if (files.length === 0) return 0;
    
    const totalScore = files.reduce((sum, file) => sum + file.qualityScore.score, 0);
    return Math.round(totalScore / files.length);
  }

  private generateRecommendations(result: HealthCheckResult): string[] {
    const recommendations: string[] = [];
    
    if (result.summary.errors > 0) {
      recommendations.push('🚨 Critical: Fix errors immediately to prevent runtime issues');
    }
    
    if (result.summary.warnings > 10) {
      recommendations.push('⚠️ Consider addressing warnings to improve translation quality');
    }
    
    if (result.summary.totalIssues === 0) {
      recommendations.push('✅ Excellent! Your translations are in great health');
    } else if (result.summary.totalIssues < 10) {
      recommendations.push('👍 Good translation health, minor issues to address');
    } else if (result.summary.totalIssues < 50) {
      recommendations.push('📝 Moderate number of issues, consider a cleanup session');
    } else {
      recommendations.push('🔧 Many issues found, recommend systematic cleanup');
    }

    // Specific recommendations based on issue types
    const issueTypes = [...new Set(result.issues.map(i => i.type))];
    
    if (issueTypes.includes('interpolation_unbalanced')) {
      recommendations.push('🔧 Fix unbalanced interpolation brackets to prevent runtime errors');
    }
    
    if (issueTypes.includes('consistency_missing_key')) {
      recommendations.push('📝 Run translation sync to add missing keys across languages');
    }
    
    if (issueTypes.includes('quality_untranslated')) {
      recommendations.push('🌐 Review and translate content marked as potentially untranslated');
    }
    
    return recommendations;
  }

  // Helper methods
  private getExpectedPluralForms(lang: string): string[] {
    switch (lang) {
      case 'en':
      case 'es':
      case 'ca':
        return ['one', 'other'];
      default:
        return ['one', 'other'];
    }
  }

  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'ca': 'Catalan'
    };
    return names[code] || code;
  }

  private extractInterpolationVars(value: string): string[] {
    const matches = value.match(/\{\{([^}]*)\}\}/g) || [];
    return matches.map(match => match.slice(2, -2).trim());
  }

  private isUntranslated(value: string, lang: string): boolean {
    // Simple heuristics for detecting untranslated content
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = value.toLowerCase().split(/\s+/);
    const englishWordCount = words.filter(word => englishWords.includes(word)).length;
    
    return lang !== 'en' && englishWordCount > words.length * 0.3;
  }

  private hasSuspiciousPattern(value: string): boolean {
    const suspiciousPatterns = [
      /^(test|todo|fixme|placeholder)/i,
      /lorem ipsum/i,
      /\[.*\]/,
      /xxx+/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(value));
  }

  private containsHtml(value: string): boolean {
    return /<[^>]+>/.test(value);
  }

  private validateTranslationLength(value: string, key: string): ValidationIssue | null {
    if (value.length > 2000) {
      return {
        type: 'quality_extremely_long',
        severity: 'warning',
        message: `Extremely long translation in "${key}" (${value.length} characters)`,
        suggestion: 'Consider breaking into smaller, manageable pieces'
      };
    }
    
    if (value.length < 2 && !key.includes('_short') && !key.includes('_abbr')) {
      return {
        type: 'quality_extremely_short',
        severity: 'info',
        message: `Very short translation in "${key}" (${value.length} characters)`,
        suggestion: 'Verify this is intentionally brief'
      };
    }
    
    return null;
  }

  private validateNamingPatterns(keys: string[], fileKey: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Check for inconsistent casing
    const camelCaseKeys = keys.filter(key => /^[a-z][a-zA-Z0-9]*$/.test(key));
    const snakeCaseKeys = keys.filter(key => /^[a-z][a-z0-9_]*$/.test(key));
    
    if (camelCaseKeys.length > 0 && snakeCaseKeys.length > 0) {
      issues.push({
        type: 'structure_inconsistent_naming',
        severity: 'info',
        message: 'Mixed naming conventions detected (camelCase and snake_case)',
        file: fileKey,
        suggestion: 'Use consistent naming convention throughout the file',
        details: { 
          camelCaseCount: camelCaseKeys.length,
          snakeCaseCount: snakeCaseKeys.length
        }
      });
    }
    
    return issues;
  }

  private validateJsonStructure(content: Record<string, unknown>, fileKey: string): void {
    // Check for circular references
    try {
      JSON.stringify(content);
    } catch (error) {
      throw new ValidationError(`Circular reference or invalid JSON structure in ${fileKey}`);
    }
  }

  private attemptJsonFix(content: Record<string, unknown>): Record<string, unknown> | null {
    try {
      // Remove circular references and fix common issues
      return JSON.parse(JSON.stringify(content));
    } catch {
      return null;
    }
  }

  private getIssueTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'file_missing': 'Translation files are missing for some languages',
      'interpolation_unbalanced': 'Interpolation brackets are not properly balanced',
      'interpolation_empty': 'Empty interpolation placeholders found',
      'interpolation_malformed': 'Malformed interpolation syntax detected',
      'consistency_missing_key': 'Keys missing in some languages',
      'consistency_type_mismatch': 'Value types differ between languages',
      'consistency_interpolation_mismatch': 'Interpolation variables differ between languages',
      'consistency_orphaned_key': 'Keys exist in target but not source language',
      'quality_untranslated': 'Content appears to be untranslated',
      'quality_suspicious_content': 'Suspicious placeholder or test content',
      'quality_html_content': 'HTML content detected in translations',
      'quality_extremely_long': 'Extremely long translation values',
      'quality_extremely_short': 'Suspiciously short translation values',
      'structure_deeply_nested': 'Deeply nested translation structure',
      'structure_inconsistent_naming': 'Inconsistent naming conventions',
      'performance_large_namespace': 'Large namespace files affecting performance',
      'performance_long_translation': 'Very long individual translations',
      'pluralization_missing_forms': 'Missing plural forms for language',
      'cross_language_missing_files': 'Missing translation files across languages',
      'json_syntax_error': 'JSON syntax errors in translation files'
    };
    
    return descriptions[type] || 'Unknown issue type';
  }
} 