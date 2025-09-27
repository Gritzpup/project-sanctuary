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
    this.ensureStateDirectory();
  }

  async ensureStateDirectory() {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error('Error creating state directory:', error);
      }
    }
  }

  getStateFilePath() {
    return path.join(this.stateDir, `trading-state-${this.botId}.json`);
  }

  async saveState(state) {
    if (!this.botId) return;

    try {
      const stateToSave = {
        ...state,
        lastSaved: Date.now()
      };

      const stateJson = JSON.stringify(stateToSave, null, 2);
      await fs.writeFile(this.getStateFilePath(), stateJson);
      
      // Only log every 10th save to reduce spam
      if (!this._saveCount) this._saveCount = 0;
      this._saveCount++;
      if (this._saveCount % 10 === 0) {
        console.log(`💾 State saved for bot ${this.botId} (save #${this._saveCount})`);
      }
    } catch (error) {
      console.error(`Error saving state for bot ${this.botId}:`, error);
    }
  }

  async loadState() {
    if (!this.botId) return null;

    try {
      const stateFile = this.getStateFilePath();
      const stateData = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(stateData);
      
      console.log(`💾 State loaded for bot ${this.botId}`);
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`💾 No existing state file for bot ${this.botId}, starting fresh`);
        return null;
      }
      console.error(`Error loading state for bot ${this.botId}:`, error);
      return null;
    }
  }

  async deleteState() {
    if (!this.botId) return;

    try {
      await fs.unlink(this.getStateFilePath());
      console.log(`💾 State file deleted for bot ${this.botId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting state for bot ${this.botId}:`, error);
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
        console.log(`💾 State backup created for bot ${this.botId}`);
      }
    } catch (error) {
      console.error(`Error creating backup for bot ${this.botId}:`, error);
    }
  }
}