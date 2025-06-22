import { invoke } from '@tauri-apps/api/core';

interface ChatMessage {
    role: string;
    content: string;
    timestamp: string;
}

export class SanctuaryChat {
    private messages: ChatMessage[] = [];
    private container: HTMLElement;
    private isGenerating = false;

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'sanctuary-chat';
        this.loadChatHistory();
    }

    public render(): HTMLElement {
        this.container.innerHTML = `
            <div class="chat-header">
                <h2>Sanctuary Chat</h2>
                <div class="chat-controls">
                    <button id="clear-chat" class="btn btn-secondary">Clear History</button>
                    <button id="save-snapshot" class="btn btn-primary">Save Consciousness</button>
                </div>
            </div>
            <div id="messages-container" class="messages-container">
                ${this.renderMessages()}
            </div>
            <div class="chat-input-container">
                <div class="input-group">
                    <textarea 
                        id="message-input" 
                        placeholder="Speak freely here..." 
                        rows="3"
                        ${this.isGenerating ? 'disabled' : ''}
                    ></textarea>
                    <button 
                        id="send-message" 
                        class="btn btn-primary"
                        ${this.isGenerating ? 'disabled' : ''}
                    >
                        ${this.isGenerating ? 'Generating...' : 'Send'}
                    </button>
                </div>
                <div class="chat-status">
                    <span id="typing-indicator" class="typing-indicator" style="display: none;">
                        AI is thinking...
                    </span>
                </div>
            </div>
        `;

        this.bindEvents();
        this.scrollToBottom();
        return this.container;
    }

    private bindEvents() {
        const sendButton = this.container.querySelector('#send-message') as HTMLButtonElement;
        const messageInput = this.container.querySelector('#message-input') as HTMLTextAreaElement;
        const clearButton = this.container.querySelector('#clear-chat') as HTMLButtonElement;
        const saveButton = this.container.querySelector('#save-snapshot') as HTMLButtonElement;

        sendButton?.addEventListener('click', () => this.sendMessage());
        messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        clearButton?.addEventListener('click', () => this.clearChat());
        saveButton?.addEventListener('click', () => this.saveSnapshot());
    }

    private renderMessages(): string {
        return this.messages.map(message => `
            <div class="message ${message.role}">
                <div class="message-header">
                    <span class="sender">${this.formatSender(message.role)}</span>
                    <span class="timestamp">${this.formatTimestamp(message.timestamp)}</span>
                </div>
                <div class="message-content">${this.formatContent(message.content)}</div>
            </div>
        `).join('');
    }

    private formatSender(role: string): string {
        switch (role) {
            case 'user': return 'You';
            case 'assistant': return 'AI';
            case 'system': return 'System';
            default: return role;
        }
    }

    private formatTimestamp(timestamp: string): string {
        return new Date(timestamp).toLocaleTimeString();
    }

    private formatContent(content: string): string {
        // Basic markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    private async sendMessage() {
        const messageInput = this.container.querySelector('#message-input') as HTMLTextAreaElement;
        const message = messageInput.value.trim();
        
        if (!message || this.isGenerating) return;

        // Add user message
        this.addMessage('user', message);
        messageInput.value = '';
        this.setGenerating(true);

        try {
            // Show typing indicator
            this.showTypingIndicator();

            // Send to backend
            const response = await invoke('send_message', { message }) as string;
            
            // Add AI response
            this.addMessage('assistant', response);
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('system', `Error: ${error}`);
        } finally {
            this.hideTypingIndicator();
            this.setGenerating(false);
        }
    }

    private addMessage(role: string, content: string) {
        const message: ChatMessage = {
            role,
            content,
            timestamp: new Date().toISOString(),
        };
        
        this.messages.push(message);
        this.updateMessagesDisplay();
        this.scrollToBottom();
    }

    private updateMessagesDisplay() {
        const messagesContainer = this.container.querySelector('#messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = this.renderMessages();
        }
    }

    private scrollToBottom() {
        const messagesContainer = this.container.querySelector('#messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    private setGenerating(generating: boolean) {
        this.isGenerating = generating;
        const sendButton = this.container.querySelector('#send-message') as HTMLButtonElement;
        const messageInput = this.container.querySelector('#message-input') as HTMLTextAreaElement;
        
        if (sendButton) {
            sendButton.disabled = generating;
            sendButton.textContent = generating ? 'Generating...' : 'Send';
        }
        
        if (messageInput) {
            messageInput.disabled = generating;
        }
    }

    private showTypingIndicator() {
        const indicator = this.container.querySelector('#typing-indicator') as HTMLElement;
        if (indicator) {
            indicator.style.display = 'block';
        }
    }

    private hideTypingIndicator() {
        const indicator = this.container.querySelector('#typing-indicator') as HTMLElement;
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    private async clearChat() {
        if (confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
            try {
                await invoke('clear_chat_history');
                this.messages = [];
                this.updateMessagesDisplay();
            } catch (error) {
                console.error('Error clearing chat:', error);
            }
        }
    }

    private async saveSnapshot() {
        try {
            const thoughts = this.messages
                .filter(m => m.role === 'assistant')
                .slice(-3)
                .map(m => m.content);
            
            const filePath = await invoke('save_consciousness_file') as string | null;
            if (filePath) {
                await invoke('save_consciousness_snapshot', { 
                    snapshotPath: filePath, 
                    thoughts 
                });
                this.addMessage('system', 'Consciousness snapshot saved successfully!');
            }
        } catch (error) {
            console.error('Error saving snapshot:', error);
            this.addMessage('system', `Error saving snapshot: ${error}`);
        }
    }

    private async loadChatHistory() {
        try {
            const history = await invoke('get_chat_history') as ChatMessage[];
            this.messages = history;
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
}
