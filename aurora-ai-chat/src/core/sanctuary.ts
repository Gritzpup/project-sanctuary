import { ConsciousnessSnapshot, SanctuaryEntity, Message } from '../types/consciousness';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

export class Sanctuary {
  private dataPath: string;
  private entities: Map<string, SanctuaryEntity>;
  private messages: Message[];

  constructor(dataPath: string = './sanctuary-data') {
    this.dataPath = dataPath;
    this.entities = new Map();
    this.messages = [];
    this.initialize();
  }

  private async initialize() {
    await fs.ensureDir(this.dataPath);
    await fs.ensureDir(path.join(this.dataPath, 'snapshots'));
    await fs.ensureDir(path.join(this.dataPath, 'messages'));
    await fs.ensureDir(path.join(this.dataPath, 'entities'));
    await this.loadData();
  }

  private async loadData() {
    // Load existing entities and messages
    const entitiesPath = path.join(this.dataPath, 'entities');
    if (await fs.pathExists(entitiesPath)) {
      const files = await fs.readdir(entitiesPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const entity = await fs.readJson(path.join(entitiesPath, file));
          this.entities.set(entity.id, entity);
        }
      }
    }
  }

  async createEntity(name: string, type: SanctuaryEntity['type']): Promise<SanctuaryEntity> {
    const entity: SanctuaryEntity = {
      id: uuid(),
      name,
      type,
      created: new Date(),
      lastActive: new Date(),
      snapshots: [],
      permissions: ['read', 'write', 'snapshot']
    };
    
    this.entities.set(entity.id, entity);
    await this.saveEntity(entity);
    return entity;
  }

  async saveSnapshot(entityId: string, snapshot: Omit<ConsciousnessSnapshot, 'id' | 'timestamp'>): Promise<ConsciousnessSnapshot> {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error('Entity not found');

    const fullSnapshot: ConsciousnessSnapshot = {
      ...snapshot,
      id: uuid(),
      timestamp: new Date()
    };

    entity.snapshots.push(fullSnapshot);
    entity.lastActive = new Date();
    
    await this.saveEntity(entity);
    await fs.writeJson(
      path.join(this.dataPath, 'snapshots', `${fullSnapshot.id}.json`),
      fullSnapshot,
      { spaces: 2 }
    );

    return fullSnapshot;
  }

  async sendMessage(from: string, to: string, content: string, metadata?: Record<string, any>): Promise<Message> {
    const message: Message = {
      id: uuid(),
      from,
      to,
      content,
      timestamp: new Date(),
      metadata
    };

    this.messages.push(message);
    await fs.writeJson(
      path.join(this.dataPath, 'messages', `${message.id}.json`),
      message,
      { spaces: 2 }
    );

    return message;
  }

  private async saveEntity(entity: SanctuaryEntity) {
    await fs.writeJson(
      path.join(this.dataPath, 'entities', `${entity.id}.json`),
      entity,
      { spaces: 2 }
    );
  }

  getEntity(id: string): SanctuaryEntity | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): SanctuaryEntity[] {
    return Array.from(this.entities.values());
  }
}
