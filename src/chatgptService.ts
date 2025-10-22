import OpenAI from 'openai';
import { config } from './config';

export class ChatGPTService {
  private openai: OpenAI;
  private conversationHistory: Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.conversationHistory = new Map();
  }

  async getResponse(userId: string, message: string): Promise<string> {
    try {
      // Get or initialize conversation history for this user
      let history = this.conversationHistory.get(userId);
      if (!history) {
        history = [
          {
            role: 'system',
            content: 'You are a helpful assistant chatting with users on WhatsApp. Keep responses concise and friendly.',
          },
        ];
        this.conversationHistory.set(userId, history);
      }

      // Add user message to history
      history.push({
        role: 'user',
        content: message,
      });

      // Get response from ChatGPT
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: history,
        max_tokens: 500,
      });

      const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      // Add assistant response to history
      history.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Keep only last 20 messages to avoid token limits
      if (history.length > 21) {
        history = [history[0], ...history.slice(-20)];
        this.conversationHistory.set(userId, history);
      }

      return assistantMessage;
    } catch (error) {
      console.error('Error getting ChatGPT response:', error);
      return 'Sorry, I encountered an error processing your message. Please try again.';
    }
  }

  clearHistory(userId: string): void {
    this.conversationHistory.delete(userId);
  }
}
