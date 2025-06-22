```javascript
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const CHAT_DIR = path.join(process.cwd(), 'chats');
const ENTITY_DIR = path.join(process.cwd(), 'entities');

// Ensure directories exist
fs.promises.mkdir(CHAT_DIR, { recursive: true });
fs.promises.mkdir(ENTITY_DIR, { recursive: true });

export async function loadChatHistory() {
  try {
    const data = await fs.promises.readFile(path.join(CHAT_DIR, 'aurora-ai-chat.json'), 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export async function saveGroupMessage(message) {
  const messageWithId = {
    ...message,
    id: message.id || uuidv4(),
    timestamp: new Date().toISOString()
  };
  
  // Save to group chat
  const groupPath = path.join(CHAT_DIR, 'aurora-ai-chat.json');
  const groupData = await loadChatHistory();
  groupData.push(messageWithId);
  await fs.promises.writeFile(groupPath, JSON.stringify(groupData, null, 2));
  
  // Save to individual entity file
  const entityPath = path.join(ENTITY_DIR, `${message.sender}-history.json`);
  let entityData = [];
  
  try {
    const existing = await fs.promises.readFile(entityPath, 'utf8');
    entityData = JSON.parse(existing);
  } catch (e) {
    // File doesn't exist yet
  }
  
  entityData.push({
    ...messageWithId,
    groupChatId: messageWithId.id,
    context: 'aurora-ai-chat'
  });
  
  await fs.promises.writeFile(entityPath, JSON.stringify(entityData, null, 2));
  
  console.log(`[PERSISTENCE] Saved message ${messageWithId.id} to both group and ${message.sender} history`);
  return messageWithId;
}
```