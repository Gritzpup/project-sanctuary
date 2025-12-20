/**
 * @file BackupDataValidator.ts
 * @description Validates backup JSON format and data structure
 */

import type { BackupData } from '../../components/backtesting/controls/BacktestingControlsTypes';

/**
 * Validation result with success status and error messages
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Required fields for valid backup data
 */
const BACKUP_REQUIRED_FIELDS = ['name', 'timestamp'];

/**
 * Validates backup data JSON format and structure
 */
export class BackupDataValidator {
  /**
   * Validate JSON text and backup format
   * @param jsonText Raw JSON text to validate
   * @returns Validation result with status and any error messages
   */
  static validateJson(jsonText: string): ValidationResult {
    // Empty input is not an error, just invalid
    if (!jsonText.trim()) {
      return { isValid: false, errors: [] };
    }

    try {
      const parsed = JSON.parse(jsonText);

      // Validate it's an object
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid backup format: must be an object');
      }

      // Check for required fields
      const missingFields = BACKUP_REQUIRED_FIELDS.filter(field => !(field in parsed));

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON format';
      return {
        isValid: false,
        errors: [message]
      };
    }
  }

  /**
   * Deep validation of backup data structure
   * @param data Unknown data to validate
   * @returns Validation result
   */
  static validateBackupData(data: unknown): ValidationResult {
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Backup data must be an object']
      };
    }

    const typed = data as Record<string, unknown>;
    const missingFields = BACKUP_REQUIRED_FIELDS.filter(field => !(field in typed));

    if (missingFields.length > 0) {
      return {
        isValid: false,
        errors: [`Missing required fields: ${missingFields.join(', ')}`]
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Get list of required backup fields
   * @returns Array of required field names
   */
  static getRequiredFields(): string[] {
    return [...BACKUP_REQUIRED_FIELDS];
  }

  /**
   * Type guard to check if data is valid BackupData
   * @param data Data to check
   * @returns True if data is valid BackupData
   */
  static isValidBackupStructure(data: unknown): data is BackupData {
    const result = this.validateBackupData(data);
    return result.isValid;
  }
}
