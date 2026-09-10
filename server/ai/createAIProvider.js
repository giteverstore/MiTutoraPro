import { AIServiceError } from './AIServiceError.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { HuggingFaceProvider } from './HuggingFaceProvider.js';
import { createTutorProviderConfiguration } from './tutor/tutorRuntimeConfig.js';

export function createAIProvider(environment = process.env) {
  const { provider, model } = createTutorProviderConfiguration(environment);
  if (provider === 'openai') {
    return new OpenAIProvider({ apiKey: environment.OPENAI_API_KEY, model });
  }
  if (provider === 'huggingface') {
    return new HuggingFaceProvider({ token: environment.HF_TOKEN, model });
  }
  throw new AIServiceError('ai/provider-unsupported', 'The configured AI Tutor provider is not supported.', { status: 503 });
}
