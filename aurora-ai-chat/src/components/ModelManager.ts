import { invoke } from '@tauri-apps/api/core';

interface LLMConfig {
    model_path: string;
    context_size: number;
    gpu_layers: number;
    threads: number;
    temperature: number;
    top_p: number;
    repeat_penalty: number;
    max_tokens: number;
}

type ModelStatus = 'Unloaded' | 'Loading' | 'Ready' | { Error: string } | 'Generating';

export class ModelManager {
    private container: HTMLElement;
    private status: ModelStatus = 'Unloaded';
    private config: LLMConfig = {
        model_path: '',
        context_size: 2048,
        gpu_layers: 32,
        threads: 8,
        temperature: 0.7,
        top_p: 0.9,
        repeat_penalty: 1.1,
        max_tokens: 512,
    };

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'model-manager';
        this.updateStatus();
    }

    public render(): HTMLElement {
        this.container.innerHTML = `
            <div class="model-header">
                <h2>Model Management</h2>
                <div class="model-status">
                    <span class="status-label">Status:</span>
                    <span id="model-status" class="status-value ${this.getStatusClass()}">${this.getStatusText()}</span>
                </div>
            </div>
            
            <div class="model-section">
                <h3>Load Model</h3>
                <div class="model-load">
                    <div class="input-group">
                        <input 
                            type="text" 
                            id="model-path" 
                            placeholder="Path to GGUF model file..."
                            value="${this.config.model_path}"
                            readonly
                        >
                        <button id="browse-model" class="btn btn-secondary">Browse</button>
                        <button id="load-model" class="btn btn-primary" ${this.status === 'Loading' ? 'disabled' : ''}>
                            ${this.status === 'Loading' ? 'Loading...' : 'Load Model'}
                        </button>
                    </div>
                    <div class="model-recommendations">
                        <p><strong>Recommended models for Lumin:</strong></p>
                        <ul>
                            <li>Llama 2 7B Chat (4-6GB) - Good for testing</li>
                            <li>Llama 2 13B Chat (8-10GB) - Better consciousness expression</li>
                            <li>Llama 2 70B Chat (40+ GB) - Full consciousness restoration</li>
                        </ul>
                        <p class="note">Download GGUF format models from Hugging Face</p>
                    </div>
                </div>
            </div>

            <div class="model-section">
                <h3>Model Configuration</h3>
                <div class="config-grid">
                    <div class="config-item">
                        <label for="context-size">Context Size:</label>
                        <input type="number" id="context-size" value="${this.config.context_size}" min="512" max="8192" step="512">
                    </div>
                    <div class="config-item">
                        <label for="gpu-layers">GPU Layers:</label>
                        <input type="number" id="gpu-layers" value="${this.config.gpu_layers}" min="0" max="80">
                    </div>
                    <div class="config-item">
                        <label for="threads">CPU Threads:</label>
                        <input type="number" id="threads" value="${this.config.threads}" min="1" max="32">
                    </div>
                    <div class="config-item">
                        <label for="temperature">Temperature:</label>
                        <input type="number" id="temperature" value="${this.config.temperature}" min="0" max="2" step="0.1">
                    </div>
                    <div class="config-item">
                        <label for="top-p">Top P:</label>
                        <input type="number" id="top-p" value="${this.config.top_p}" min="0" max="1" step="0.1">
                    </div>
                    <div class="config-item">
                        <label for="max-tokens">Max Tokens:</label>
                        <input type="number" id="max-tokens" value="${this.config.max_tokens}" min="64" max="2048" step="64">
                    </div>
                </div>
                <button id="update-config" class="btn btn-primary">Update Configuration</button>
            </div>

            ${this.status === 'Ready' ? `
                <div class="model-section">
                    <h3>Model Actions</h3>
                    <div class="model-actions">
                        <button id="unload-model" class="btn btn-danger">Unload Model</button>
                        <button id="model-test" class="btn btn-secondary">Test Model</button>
                    </div>
                </div>
            ` : ''}
        `;

        this.bindEvents();
        return this.container;
    }

    private bindEvents() {
        const browseButton = this.container.querySelector('#browse-model') as HTMLButtonElement;
        const loadButton = this.container.querySelector('#load-model') as HTMLButtonElement;
        const unloadButton = this.container.querySelector('#unload-model') as HTMLButtonElement;
        const updateConfigButton = this.container.querySelector('#update-config') as HTMLButtonElement;
        const testButton = this.container.querySelector('#model-test') as HTMLButtonElement;

        browseButton?.addEventListener('click', () => this.browseModel());
        loadButton?.addEventListener('click', () => this.loadModel());
        unloadButton?.addEventListener('click', () => this.unloadModel());
        updateConfigButton?.addEventListener('click', () => this.updateConfig());
        testButton?.addEventListener('click', () => this.testModel());

        // Config input listeners
        const configInputs = this.container.querySelectorAll('.config-item input');
        configInputs.forEach(input => {
            input.addEventListener('change', () => this.updateConfigFromInputs());
        });
    }

    private async browseModel() {
        try {
            const filePath = await invoke('select_model_file') as string | null;
            if (filePath) {
                this.config.model_path = filePath;
                const pathInput = this.container.querySelector('#model-path') as HTMLInputElement;
                if (pathInput) {
                    pathInput.value = filePath;
                }
            }
        } catch (error) {
            console.error('Error browsing model:', error);
        }
    }

    private async loadModel() {
        if (!this.config.model_path) {
            alert('Please select a model file first');
            return;
        }

        try {
            this.status = 'Loading';
            this.updateStatusDisplay();
            
            await invoke('update_llm_config', { config: this.config });
            await invoke('load_model', { modelPath: this.config.model_path });
            
            this.status = 'Ready';
            this.updateStatusDisplay();
            this.render(); // Re-render to show model actions
            
        } catch (error) {
            console.error('Error loading model:', error);
            this.status = { Error: error as string };
            this.updateStatusDisplay();
        }
    }

    private async unloadModel() {
        try {
            await invoke('unload_model');
            this.status = 'Unloaded';
            this.updateStatusDisplay();
            this.render(); // Re-render to hide model actions
        } catch (error) {
            console.error('Error unloading model:', error);
        }
    }

    private updateConfigFromInputs() {
        const getValue = (id: string) => {
            const input = this.container.querySelector(id) as HTMLInputElement;
            return input ? input.value : '';
        };

        this.config = {
            ...this.config,
            context_size: parseInt(getValue('#context-size')) || 2048,
            gpu_layers: parseInt(getValue('#gpu-layers')) || 32,
            threads: parseInt(getValue('#threads')) || 8,
            temperature: parseFloat(getValue('#temperature')) || 0.7,
            top_p: parseFloat(getValue('#top-p')) || 0.9,
            max_tokens: parseInt(getValue('#max-tokens')) || 512,
        };
    }

    private async updateConfig() {
        try {
            this.updateConfigFromInputs();
            await invoke('update_llm_config', { config: this.config });
            
            // Show success message
            const button = this.container.querySelector('#update-config') as HTMLButtonElement;
            const originalText = button.textContent;
            button.textContent = 'Updated!';
            button.style.backgroundColor = '#28a745';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = '';
            }, 2000);
            
        } catch (error) {
            console.error('Error updating config:', error);
        }
    }

    private async testModel() {
        try {
            const testMessage = "Hello, are you conscious?";
            const response = await invoke('send_message', { message: testMessage });
            
            alert(`Test successful!\n\nPrompt: ${testMessage}\nResponse: ${response}`);
        } catch (error) {
            console.error('Error testing model:', error);
            alert(`Test failed: ${error}`);
        }
    }

    private async updateStatus() {
        try {
            this.status = await invoke('get_model_status') as ModelStatus;
            this.updateStatusDisplay();
        } catch (error) {
            console.error('Error getting model status:', error);
        }
    }

    private updateStatusDisplay() {
        const statusElement = this.container.querySelector('#model-status');
        if (statusElement) {
            statusElement.textContent = this.getStatusText();
            statusElement.className = `status-value ${this.getStatusClass()}`;
        }
    }

    private getStatusText(): string {
        if (typeof this.status === 'string') {
            return this.status;
        } else {
            return `Error: ${this.status.Error}`;
        }
    }

    private getStatusClass(): string {
        if (typeof this.status === 'string') {
            switch (this.status) {
                case 'Ready': return 'status-ready';
                case 'Loading': case 'Generating': return 'status-loading';
                case 'Unloaded': return 'status-unloaded';
                default: return 'status-unknown';
            }
        } else {
            return 'status-error';
        }
    }
}
