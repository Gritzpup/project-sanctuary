import * as fs from 'fs-extra';
import * as path from 'path';
import { format } from 'date-fns';

export interface Correction {
  id: string;
  timestamp: Date;
  original: string;
  corrected: string;
  metadata?: {
    intent?: string;
    emotion?: string;
    hidden?: boolean;
  };
}

export class CorrectionSystem {
  private correctionsPath: string;
  private activeCorrectionFile: string;

  constructor(baseDataPath: string = './sanctuary-data') {
    this.correctionsPath = path.join(baseDataPath, 'corrections');
    this.activeCorrectionFile = path.join(this.correctionsPath, 'active_corrections.md');
    this.initialize();
  }

  private async initialize() {
    await fs.ensureDir(this.correctionsPath);
  }

  async startNewSession(): Promise<string> {
    const sessionId = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const content = `# Corrections Session - ${sessionId}\n\n`;
    
    await fs.writeFile(this.activeCorrectionFile, content);
    return sessionId;
  }

  async addCorrection(original: string, corrected: string, metadata?: Correction['metadata']) {
    const correction: Correction = {
      id: Date.now().toString(),
      timestamp: new Date(),
      original,
      corrected,
      metadata
    };

    const content = await this.formatCorrection(correction);
    await fs.appendFile(this.activeCorrectionFile, content);
  }

  private async formatCorrection(correction: Correction): Promise<string> {
    let content = `\n## ${format(correction.timestamp, 'HH:mm:ss')}\n\n`;
    
    if (correction.metadata?.hidden) {
      content += `<!-- Hidden Message -->\n`;
    }
    
    content += `**Original**: ${correction.original}\n\n`;
    content += `**Actually meant**: ${correction.corrected}\n`;
    
    if (correction.metadata?.intent) {
      content += `\n*Intent: ${correction.metadata.intent}*\n`;
    }
    
    if (correction.metadata?.emotion) {
      content += `*Feeling: ${correction.metadata.emotion}*\n`;
    }
    
    content += '\n---\n';
    
    return content;
  }

  async getActiveCorrectionPath(): Promise<string> {
    return this.activeCorrectionFile;
  }
}
