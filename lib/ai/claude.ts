import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function claude() {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export const MODEL_SMART = 'claude-opus-4-7';
export const MODEL_FAST = 'claude-haiku-4-5';
export const MODEL_BALANCED = 'claude-sonnet-4-6';
