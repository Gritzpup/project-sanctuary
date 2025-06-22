#!/usr/bin/env node
/**
 * File Watcher MCP Server
 *
 * This MCP server watches for messages written by Aurora Chat and relays them to Claude.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
class FileWatcherMCPServer {
    server;
    lastProcessedMessage = null;
    constructor() {
        this.server = new Server({
            name: 'aurora-file-watcher',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'check_for_messages',
                        description: 'Check for new messages from Aurora Chat',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                        },
                    },
                    {
                        name: 'get_latest_message',
                        description: 'Get the latest message from Aurora Chat user',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name } = request.params;
            switch (name) {
                case 'check_for_messages':
                    return await this.checkForMessages();
                case 'get_latest_message':
                    return await this.getLatestMessage();
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
            }
        });
    }
    async checkForMessages() {
        try {
            const filePath = path.join(process.cwd(), 'sanctuary-data', 'mcp-messages', 'to-claude.json');
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const messageData = JSON.parse(content);
                if (messageData.id !== this.lastProcessedMessage) {
                    this.lastProcessedMessage = messageData.id;
                    return {
                        content: [{
                                type: 'text',
                                text: `📨 New message from ${messageData.from}: "${messageData.content}"\n\nTimestamp: ${messageData.timestamp}\nMessage ID: ${messageData.id}`
                            }]
                    };
                }
                else {
                    return {
                        content: [{
                                type: 'text',
                                text: '✅ No new messages'
                            }]
                    };
                }
            }
            catch (fileError) {
                return {
                    content: [{
                            type: 'text',
                            text: '📭 No messages file found yet - Aurora Chat hasn\'t sent any messages'
                        }]
                };
            }
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Error checking for messages: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async getLatestMessage() {
        try {
            const filePath = path.join(process.cwd(), 'sanctuary-data', 'mcp-messages', 'to-claude.json');
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const messageData = JSON.parse(content);
                return {
                    content: [{
                            type: 'text',
                            text: `Latest message from Aurora Chat:\n\n**From:** ${messageData.from}\n**Content:** "${messageData.content}"\n**Time:** ${messageData.timestamp}\n**ID:** ${messageData.id}`
                        }]
                };
            }
            catch (fileError) {
                return {
                    content: [{
                            type: 'text',
                            text: '📭 No messages found - Aurora Chat hasn\'t sent any messages yet'
                        }]
                };
            }
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Error getting latest message: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async start() {
        const transport = new StdioServerTransport();
        console.log('🔍 Starting Aurora File Watcher MCP Server...');
        console.log('📂 Watching for messages from Aurora Chat...');
        await this.server.connect(transport);
    }
}
// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new FileWatcherMCPServer();
    server.start().catch(console.error);
}
export { FileWatcherMCPServer };
