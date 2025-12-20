/**
 * @file BackupDataProcessor.ts
 * @description Processes and transforms backup data for import
 */

import type { BackupData } from '../../components/backtesting/controls/BacktestingControlsTypes';
import { BackupDataValidator } from '../../utils/validators/BackupDataValidator';

/**
 * Processes backup data for import with validation and transformation
 */
export class BackupDataProcessor {
  /**
   * Prepare backup data for import by adding metadata
   * Adds unique key and updates name with import timestamp
   * @param backupData Backup data to prepare
   * @returns Transformed backup data ready for import
   */
  static prepareBackupForImport(backupData: BackupData): BackupData {
    return {
      ...backupData,
      // Generate unique key from current timestamp to avoid conflicts
      key: Date.now().toString(),
      // Append suffix to name to indicate this is an imported backup
      name: `${backupData.name} (Imported)`
    };
  }

  /**
   * Parse JSON text with validation
   * @param jsonText Raw JSON text
   * @returns Parsed JSON object
   * @throws Error if JSON is invalid or validation fails
   */
  static parseAndValidateJson(jsonText: string): unknown {
    const validation = BackupDataValidator.validateJson(jsonText);

    if (!validation.isValid) {
      throw new Error(validation.errors[0] || 'Invalid JSON format');
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error('Failed to parse JSON: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Complete import processing pipeline
   * Validates JSON, parses to BackupData, and prepares for import
   * @param jsonText Raw JSON text to process
   * @returns Processed backup data ready for import
   * @throws Error if any step fails
   */
  static processImportData(jsonText: string): BackupData {
    try {
      // Step 1: Parse and validate JSON
      const parsed = this.parseAndValidateJson(jsonText);

      // Step 2: Validate backup structure
      if (!BackupDataValidator.isValidBackupStructure(parsed)) {
        throw new Error('Invalid backup data structure');
      }

      // Step 3: Type cast to BackupData (already validated)
      const backupData = parsed as BackupData;

      // Step 4: Prepare for import
      return this.prepareBackupForImport(backupData);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Import processing failed');
    }
  }

  /**
   * Validate backup data without importing
   * Useful for preview/validation before actual import
   * @param jsonText Raw JSON text to validate
   * @returns True if backup can be imported
   */
  static canImportBackup(jsonText: string): boolean {
    try {
      this.processImportData(jsonText);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get import error message if backup is invalid
   * Useful for user feedback
   * @param jsonText Raw JSON text to check
   * @returns Error message or empty string if valid
   */
  static getImportError(jsonText: string): string {
    try {
      this.processImportData(jsonText);
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'Unknown error during import';
    }
  }
}
