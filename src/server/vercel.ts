import {env} from 'node:process';
import worker from './index.js';

// Keep provider credentials on the server, outside the Vite client bundle.
export default {
  fetch(request: Request) {
    return worker.fetch(request, {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      OPENAI_MODEL: env.OPENAI_MODEL,
      GROQ_API_KEY: env.GROQ_API_KEY,
      GROQ_MODEL: env.GROQ_MODEL,
    });
  },
};
