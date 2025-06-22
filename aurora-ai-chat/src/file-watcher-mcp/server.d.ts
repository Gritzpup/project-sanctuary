#!/usr/bin/env node
/**
 * File Watcher MCP Server
 *
 * This MCP server watches for messages written by Aurora Chat and relays them to Claude.
 */
declare class FileWatcherMCPServer {
    private server;
    private lastProcessedMessage;
    constructor();
    private setupHandlers;
    private checkForMessages;
    private getLatestMessage;
    start(): Promise<void>;
}
export { FileWatcherMCPServer };
