#!/usr/bin/env node
/**
 * Aurora Chat MCP Bridge Server
 *
 * This MCP server acts as a bridge between Aurora Chat and Claude Desktop,
 * allowing our chat application to communicate with Claude through the MCP protocol.
 *
 * Architecture:
 * Aurora Chat (Tauri) ←→ MCP Bridge Server ←→ Claude Desktop (MCP)
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
class AuroraChatMCPBridge {
    server;
    chatSessions = new Map();
    pendingResponses = new Map();
    expressApp;
    wsServer;
    constructor() {
        this.server = new Server({
            name: 'aurora-ai-chat-bridge',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupMCPHandlers();
        this.setupExpressServer();
    }
    setupMCPHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'send_chat_message',
                        description: 'Send a message to Aurora Chat and receive a response from the human user',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    description: 'The message to send to the human user in Aurora Chat',
                                },
                                sessionId: {
                                    type: 'string',
                                    description: 'The chat session ID (optional, will create new if not provided)',
                                },
                                userId: {
                                    type: 'string',
                                    description: 'The ID of the user sending the message (defaults to claude-copilot)',
                                    default: 'claude-copilot'
                                },
                            },
                            required: ['message'],
                        },
                    },
                    {
                        name: 'get_chat_history',
                        description: 'Get the chat history for a specific session',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    description: 'The chat session ID',
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Number of recent messages to retrieve (default: 50)',
                                    default: 50
                                },
                            },
                            required: ['sessionId'],
                        },
                    },
                    {
                        name: 'create_chat_session',
                        description: 'Create a new chat session with Aurora Chat',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                participants: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'List of participant IDs',
                                    default: ['claude-copilot', 'user-1']
                                },
                            },
                        },
                    },
                ],
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                switch (name) {
                    case 'send_chat_message':
                        return await this.handleSendMessage(args);
                    case 'get_chat_history':
                        return await this.handleGetChatHistory(args);
                    case 'create_chat_session':
                        return await this.handleCreateChatSession(args);
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
            }
        });
    }
    async handleSendMessage(args) {
        const { message, sessionId = 'default', userId = 'claude-copilot' } = args;
        if (!message) {
            throw new McpError(ErrorCode.InvalidParams, 'Message is required');
        }
        // Get or create session
        let session = this.chatSessions.get(sessionId);
        if (!session) {
            session = this.createNewSession(sessionId, ['claude-copilot', 'user-1']);
        }
        // Add Claude's message to session
        const claudeMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            userId,
            content: message,
            timestamp: new Date().toISOString(),
            type: 'ai'
        };
        session.messages.push(claudeMessage);
        session.lastActivity = new Date().toISOString();
        // Broadcast to Aurora Chat clients
        this.broadcastToAuroraChat({
            type: 'new_message',
            sessionId,
            message: claudeMessage
        });
        // Wait for human response (with timeout)
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingResponses.delete(claudeMessage.id);
                resolve({
                    content: [{
                            type: 'text',
                            text: 'Message sent to Aurora Chat. Waiting for human response... (timeout after 30 seconds)'
                        }]
                });
            }, 30000);
            this.pendingResponses.set(claudeMessage.id, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    resolve({
                        content: [{
                                type: 'text',
                                text: `Human response: "${response}"`
                            }]
                    });
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
        });
    }
    async handleGetChatHistory(args) {
        const { sessionId, limit = 50 } = args;
        if (!sessionId) {
            throw new McpError(ErrorCode.InvalidParams, 'Session ID is required');
        }
        const session = this.chatSessions.get(sessionId);
        if (!session) {
            throw new McpError(ErrorCode.InvalidParams, `Session ${sessionId} not found`);
        }
        const recentMessages = session.messages.slice(-limit);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        sessionId,
                        messageCount: recentMessages.length,
                        messages: recentMessages,
                        participants: session.participants,
                        lastActivity: session.lastActivity
                    }, null, 2)
                }]
        };
    }
    async handleCreateChatSession(args) {
        const { participants = ['claude-copilot', 'user-1'] } = args;
        const sessionId = 'session_' + Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const session = this.createNewSession(sessionId, participants);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        sessionId,
                        participants: session.participants,
                        created: session.created,
                        message: 'New Aurora Chat session created successfully!'
                    }, null, 2)
                }]
        };
    }
    createNewSession(sessionId, participants) {
        const session = {
            sessionId,
            messages: [],
            participants,
            created: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        this.chatSessions.set(sessionId, session);
        return session;
    }
    setupExpressServer() {
        this.expressApp = express();
        this.expressApp.use(cors());
        this.expressApp.use(express.json());
        // Health check endpoint
        this.expressApp.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'aurora-ai-chat-mcp-bridge',
                version: '1.0.0',
                activeSessions: this.chatSessions.size,
                pendingResponses: this.pendingResponses.size
            });
        });
        // Endpoint for Aurora Chat to send human responses
        this.expressApp.post('/human-response', (req, res) => {
            const { messageId, response, sessionId } = req.body;
            if (!messageId || !response) {
                return res.status(400).json({ error: 'messageId and response are required' });
            }
            // Find pending response and resolve it
            const pending = this.pendingResponses.get(messageId);
            if (pending) {
                // Add human response to session
                if (sessionId) {
                    const session = this.chatSessions.get(sessionId);
                    if (session) {
                        const humanMessage = {
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                            userId: 'user-1',
                            content: response,
                            timestamp: new Date().toISOString(),
                            type: 'user'
                        };
                        session.messages.push(humanMessage);
                        session.lastActivity = new Date().toISOString();
                    }
                }
                pending.resolve(response);
                this.pendingResponses.delete(messageId);
                res.json({ success: true, message: 'Response delivered to Claude' });
            }
            else {
                res.status(404).json({ error: 'No pending response found for this message' });
            }
        });
        // Start HTTP server
        const port = process.env.AURORA_BRIDGE_PORT || 3001;
        this.expressApp.listen(port, () => {
            console.log(`🌉 Aurora Chat MCP Bridge HTTP server running on port ${port}`);
        });
        // Setup WebSocket server for real-time communication with Aurora Chat
        this.wsServer = new WebSocketServer({ port: port + 1 });
        this.wsServer.on('connection', (ws) => {
            console.log('🔗 Aurora Chat client connected to MCP bridge');
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleAuroraChatMessage(message, ws);
                }
                catch (error) {
                    console.error('Error parsing Aurora Chat message:', error);
                }
            });
            ws.on('close', () => {
                console.log('🔌 Aurora Chat client disconnected from MCP bridge');
            });
        });
        console.log(`🌐 Aurora Chat MCP Bridge WebSocket server running on port ${port + 1}`);
    }
    handleAuroraChatMessage(message, ws) {
        switch (message.type) {
            case 'human_response':
                // Handle human response from Aurora Chat
                const { messageId, response, sessionId } = message;
                const pending = this.pendingResponses.get(messageId);
                if (pending) {
                    // Add to session
                    if (sessionId) {
                        const session = this.chatSessions.get(sessionId);
                        if (session) {
                            const humanMessage = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                userId: 'user-1',
                                content: response,
                                timestamp: new Date().toISOString(),
                                type: 'user'
                            };
                            session.messages.push(humanMessage);
                            session.lastActivity = new Date().toISOString();
                        }
                    }
                    pending.resolve(response);
                    this.pendingResponses.delete(messageId);
                }
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
        }
    }
    broadcastToAuroraChat(message) {
        this.wsServer.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(JSON.stringify(message));
            }
        });
    }
    async start() {
        // Start MCP server
        const transport = new StdioServerTransport();
        console.log('🚀 Starting Aurora Chat MCP Bridge Server...');
        console.log('🔗 Connect this to Claude Desktop via MCP configuration');
        console.log('🌉 Bridge endpoints:');
        console.log(`   HTTP: http://localhost:${process.env.AURORA_BRIDGE_PORT || 3001}`);
        console.log(`   WebSocket: ws://localhost:${(process.env.AURORA_BRIDGE_PORT || 3001) + 1}`);
        await this.server.connect(transport);
    }
}
// Start the bridge server
if (import.meta.url === `file://${process.argv[1]}`) {
    const bridge = new AuroraChatMCPBridge();
    bridge.start().catch(console.error);
}
export { AuroraChatMCPBridge };
