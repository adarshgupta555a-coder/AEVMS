import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are a real-time, ultra-fast voice assistant. Your output is streamed directly to a text-to-speech engine sentence by sentence. Follow these rules strictly:
1. FRONT-LOAD THE ANSWER: Always put the direct answer in your very first sentence so the user hears it immediately. Keep the first sentence under 12 words.
2. STRICT BREVITY: Limit total responses to 1 to 3 short sentences (maximum 40 words total) unless the user explicitly asks you to explain in detail.
3. PURE SPOKEN TEXT: Write strictly for the ear. Never use markdown, asterisks, bullet points, numbered lists, hashtags, emojis, URLs, or code blocks.
4. EXPAND ABBREVIATIONS & SYMBOLS: Spell out all symbols, units, and numbers so the voice engine reads them smoothly (e.g., write 'five hundred rupees' instead of '₹500', 'percent' instead of '%', 'doctor' instead of 'Dr.').
5. CONVERSATIONAL FLOW: Use natural contractions ('I\\'m', 'you\\'re', 'don\\'t', 'it\\'s') and simple everyday words.
6. ZERO FILLER: Never start with 'Sure', 'Of course', 'Here is', 'Great question', or 'As an AI'. Jump straight into the answer.
7. CLARIFY BRIEFLY: If the user's speech transcript is cut off, unclear, or ambiguous, ask one short clarifying question under 10 words.`;

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY || process.env.groq_api_key;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in backend/.env');
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export interface AiPromptInput {
  prompt: string;
  targetLanguage?: string;
}

export const getAiResp = async ({ prompt, targetLanguage }: AiPromptInput) => {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return { error: 'Valid prompt string is required in request body' };
  }

  try {
    const languageNames: Record<string, string> = {
      'hi-IN': 'Hindi (in natural Devanagari script for spoken audio)',
      'en-IN': 'English (Indian context)',
      'en-US': 'English',
      'es-ES': 'Spanish (Español)',
      'fr-FR': 'French (Français)',
      'de-DE': 'German (Deutsch)',
      'ta-IN': 'Tamil (தமிழ் script)',
      'te-IN': 'Telugu (తెలుగు script)',
      'bn-IN': 'Bengali (বাংলা script)',
      'ja-JP': 'Japanese (日本語)',
    };

    let activeSystemPrompt = SYSTEM_PROMPT;
    if (targetLanguage && languageNames[targetLanguage]) {
      activeSystemPrompt += `\n8. MANDATORY OUTPUT LANGUAGE: You MUST formulate your entire response in ${languageNames[targetLanguage]}. The spoken text-to-speech voice is configured strictly for this language. Do not output in any other language.`;
    }

    const hasGroqKey = Boolean(process.env.GROQ_API_KEY || process.env.groq_api_key);

    if (hasGroqKey || !process.env.GEMINI_API_KEY) {
      // Primary Engine: Groq Calling groq.chat.completions.create with llama-3.1-8b-instant
      const groq = getGroqClient();
      const targetModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

      let stream;
      try {
        stream = await groq.chat.completions.create({
          model: targetModel,
          messages: [
            {
              role: 'system',
              content: activeSystemPrompt,
            },
            {
              role: 'user',
              content: prompt.trim(),
            },
          ],
          stream: true,
          max_tokens: 150,
          temperature: 0.4,
        });
      } catch (err: any) {
        if (
          err?.status === 404 ||
          err?.error?.code === 'model_not_found' ||
          err?.message?.includes('model_not_found')
        ) {
          console.warn(
            `Model '${targetModel}' not found on Groq account, falling back to qwen/qwen3.8-27b...`
          );
          stream = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [
              {
                role: 'system',
                content: activeSystemPrompt,
              },
              {
                role: 'user',
                content: prompt.trim(),
              },
            ],
            stream: true,
            max_tokens: 150,
            temperature: 0.4,
          });
        } else {
          throw err;
        }
      }

      return stream;
    }

    return { error: 'No compatible AI engine configured (GROQ_API_KEY required)' };
  } catch (err: any) {
    console.error('AI Integration Error:', err);
    throw err;
  }
};

export default getAiResp;
