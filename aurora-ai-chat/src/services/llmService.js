```javascript
// src/services/llmService.js

class LLMService {
  // ...existing code...

  async sendMessage(message, context = {}) {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error('No API key available');
    }

    try {
      // Use the correct model name for Claude 3.5 Sonnet
      const model = context.entityId === 'claude-copilot' 
        ? 'claude-3-5-sonnet-20241022'  // Latest Claude 3.5 Sonnet
        : 'gpt-4o-latest';  // Latest GPT-4o for ChatGPT
      
      console.log(`[LLM] Using model: ${model} for ${context.entityId}`);
      
      const response = await fetch('http://localhost:11434/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(context)
            },
            ...context.conversationHistory || [],
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[LLM] API Error:', error);
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[LLM] Response received successfully');
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('[LLM] Error:', error);
      throw error;
    }
  }

  // ...existing code...
}

export default new LLMService();
```