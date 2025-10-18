import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TradingStateRepository {
  constructor(botId) {
    this.botId = botId;
    this.stateDir = path.join(__dirname, '../../../data');
    this.writeQueue = []; // Queue for serialized writes
    this.isWriting = false; // Flag to prevent concurrent writes
    this.ensureStateDirectory();
  }

  async ensureStateDirectory() {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        // PERF: Disabled - console.error('Error creating state directory:', error);
      }
    }
  }

  getStateFilePath() {
    return path.join(this.stateDir, `trading-state-${this.botId}.json`);
  }

  async saveState(state) {
    if (!this.botId) return;

    // Queue the write operation
    return new Promise((resolve) => {
      this.writeQueue.push(async () => {
        try {
          const stateToSave = {
            ...state,
            lastSaved: Date.now()
          };

          const stateJson = JSON.stringify(stateToSave, null, 2);
          const filePath = this.getStateFilePath();
          const tempFilePath = filePath + '.tmp';

          // ATOMIC WRITE: Write to temp file first, then rename
          // This prevents partial/corrupted JSON if process crashes during write
          await fs.writeFile(tempFilePath, stateJson);
          await fs.rename(tempFilePath, filePath);

          // Only log every 10th save to reduce spam
          if (!this._saveCount) this._saveCount = 0;
          this._saveCount++;
          if (this._saveCount % 10 === 0) {
            // PERF: Disabled - console.log(`💾 State saved for bot ${this.botId} (save #${this._saveCount})`);
          }
        } catch (error) {
          // PERF: Disabled - console.error(`Error saving state for bot ${this.botId}:`, error);
        } finally {
          resolve();
        }
      });

      this._processWriteQueue();
    });
  }

  async _processWriteQueue() {
    // If already writing, let the current write complete first
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;
    const writeOperation = this.writeQueue.shift();

    try {
      await writeOperation();
    } finally {
      this.isWriting = false;
      // Process next item in queue if any
      if (this.writeQueue.length > 0) {
        this._processWriteQueue();
      }
    }
  }

  async loadState() {
    if (!this.botId) return null;

    try {
      const stateFile = this.getStateFilePath();
      const stateData = await fs.readFile(stateFile, 'utf8');

      // Validate JSON is not empty/incomplete before parsing
      if (!stateData || stateData.trim().length === 0) {
        console.warn(`⚠️ [State] Empty state file for ${this.botId}, starting fresh`);
        return null;
      }

      const state = JSON.parse(stateData);

      // PERF: Disabled - console.log(`💾 State loaded for bot ${this.botId}`);
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // PERF: Disabled - console.log(`💾 No existing state file for bot ${this.botId}, starting fresh`);
        return null;
      }
      // Corrupted JSON - log this as it indicates a real problem
      if (error instanceof SyntaxError) {
        console.warn(`⚠️ [State] Corrupted state file for ${this.botId}: ${error.message}, starting fresh`);
        // Attempt to delete the corrupted file
        try {
          await fs.unlink(this.getStateFilePath());
        } catch (e) {
          // Silent fail on cleanup
        }
        return null;
      }
      // PERF: Disabled - console.error(`Error loading state for bot ${this.botId}:`, error);
      return null;
    }
  }

  async deleteState() {
    if (!this.botId) return;

    try {
      await fs.unlink(this.getStateFilePath());
      // PERF: Disabled - console.log(`💾 State file deleted for bot ${this.botId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // PERF: Disabled - console.error(`Error deleting state for bot ${this.botId}:`, error);
      }
    }
  }

  async backupState() {
    if (!this.botId) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.stateDir, `trading-state-${this.botId}-backup-${timestamp}.json`);
      
      const currentState = await this.loadState();
      if (currentState) {
        await fs.writeFile(backupPath, JSON.stringify(currentState, null, 2));
        // PERF: Disabled - console.log(`💾 State backup created for bot ${this.botId}`);
      }
    } catch (error) {
      // PERF: Disabled - console.error(`Error creating backup for bot ${this.botId}:`, error);
    }
  }
}