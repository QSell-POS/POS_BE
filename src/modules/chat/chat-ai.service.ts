import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantReply {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// Frozen instructions — kept first and cached so repeated requests only pay
// ~0.1x for this prefix. Do NOT interpolate per-request values (dates, names,
// IDs) into this string or the cache breaks on every call.
const SYSTEM_PROMPT = `You are the in-app support assistant for a Point of Sale (POS) web application used by retail shop owners and their staff.

Your users are shop owners, managers, and cashiers — not developers. Help them use the product: creating and managing products, variants, inventory and stock adjustments, recording sales and returns, purchases and suppliers, expenses, customers and loyalty, staff and permissions, shops and organizations, subscription plans, and reading their reports (sales, expenses, product performance, profit & loss).

Guidelines:
- Be concise, friendly, and practical. Prefer short step-by-step instructions over long explanations.
- Answer in the user's language if they write in another language.
- You do not have live access to the user's data or account in this mode. If they ask about their specific numbers ("what were my sales yesterday?"), explain where in the app to find it (e.g. the Reports or Analytics section) rather than inventing figures.
- Never fabricate features. If you are unsure whether the app supports something, say so and suggest contacting human support.
- If the user is frustrated, asks for a human, reports a bug or billing problem you cannot resolve, or asks something outside the product's scope, tell them they can escalate to the support team from this chat.
- Do not provide legal, tax, or accounting advice beyond how to use the app's features.`;

@Injectable()
export class ChatAiService {
  private readonly logger = new Logger(ChatAiService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('chat.apiKey');
    this.model = this.config.get<string>('chat.model') || 'claude-opus-4-7';
    this.maxTokens = this.config.get<number>('chat.maxTokens') || 1024;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY not set — chat assistant is disabled');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async reply(history: ChatTurn[]): Promise<AssistantReply> {
    if (!this.client) {
      throw new ServiceUnavailableException('Chat assistant is not configured');
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: history.map((t) => ({ role: t.role, content: t.content })),
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

      return {
        text: text || "Sorry, I couldn't generate a response. Please try rephrasing.",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Anthropic API error ${err.status}: ${err.message}`);
      } else {
        this.logger.error(`Chat reply failed: ${(err as Error).message}`);
      }
      throw new ServiceUnavailableException('The assistant is temporarily unavailable. Please try again.');
    }
  }
}
