/**
 * @file BackupFileHandler.ts
 * @description Handles file I/O operations for backup import
 */

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Handles backup file reading and processing
 */
export class BackupFileHandler {
  /**
   * Validate file type before processing
   * @param file File to validate
   * @returns Validation result with error message if invalid
   */
  static validateFileType(file: File): FileValidationResult {
    const isJsonMimeType = file.type === 'application/json';
    const isJsonExtension = file.name.endsWith('.json');

    // Accept either correct MIME type or .json extension
    if (!isJsonMimeType && !isJsonExtension) {
      return {
        isValid: false,
        error: 'Please select a JSON file'
      };
    }

    return { isValid: true };
  }

  /**
   * Read file content as text using FileReader API
   * @param file File to read
   * @returns Promise resolving to file content as string
   */
  static readFileAsJson(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text || '');
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Handle file upload event and return JSON text
   * Orchestrates validation and reading
   * @param event File input change event
   * @returns Promise resolving to file content as JSON text
   * @throws Error if file is invalid or reading fails
   */
  static async handleFileUpload(event: Event): Promise<string> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      throw new Error('No file selected');
    }

    // Validate file type
    const validation = this.validateFileType(file);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid file type');
    }

    // Read file content
    const jsonText = await this.readFileAsJson(file);

    // Clear the input so the same file can be selected again if needed
    target.value = '';

    return jsonText;
  }

  /**
   * Check if a file size is reasonable for JSON backup
   * @param file File to check
   * @param maxSizeMB Maximum allowed size in megabytes (default 50MB)
   * @returns True if file size is acceptable
   */
  static isFileSizeAcceptable(file: File, maxSizeMB: number = 50): boolean {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxBytes;
  }

  /**
   * Get human-readable file size
   * @param bytes File size in bytes
   * @returns Formatted file size string
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
