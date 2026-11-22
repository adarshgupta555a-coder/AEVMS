# 🎙️ Aura Voice AI — Real-Time Multilingual Voice Concierge
> **Complete Integration & Handoff Guide for Event Management Platforms & Future AGY (Antigravity) Sessions**

---

## 📌 Executive Summary
**Aura Voice AI** is an ultra-fast, streaming, sentence-by-sentence multilingual AI voice assistant. It was engineered specifically to serve as a **real-time voice concierge** for web applications, with primary focus on **Event Management Systems** (answering attendee questions about schedules, venues, registrations, speaker lineups, ticket tiers, and live bilingual assistance).

This README is structured specifically so that:
1. **Any developer or AGY (Antigravity) AI agent** can copy and integrate this voice assistant into an existing or new Event Management project in under 15 minutes.
2. **All solved architectural gotchas and bugs** (voiceURI crashes, queue skips, STT lock) are explicitly documented so they are never reintroduced.

---

## 📑 Table of Contents
1. [🎪 Event Management Integration Guide (How to Port to Another Project)](#-event-management-integration-guide)
2. [🌐 Dual-Language Architecture (STT vs TTS Decoupling)](#-dual-language-architecture-stt-vs-tts)
3. [⚡ Latency & Streaming Sentence Queue Pipeline](#-latency--streaming-sentence-queue-pipeline)
4. [🛠️ Step-by-Step Copy-Paste Implementation](#️-step-by-step-copy-paste-implementation)
   - [A. Backend Integration](#a-backend-integration)
   - [B. Frontend Integration](#b-frontend-integration)
5. [⚠️ Critical AGY Session Gotchas (Past Bugs & Solutions)](#️-critical-agy-session-gotchas-past-bugs--solutions)
6. [📡 Backend API Specifications](#-backend-api-specifications)
7. [🧪 Verification & Testing Checklist](#-verification--testing-checklist)

---

## 🎪 Event Management Integration Guide

When importing this voice assistant into an **Event Management Platform**, use it for:
- **Attendee Voice Helpdesk**: Live verbal queries like *"Where is Hall 3?"*, *"When does the AI keynote start?"*, *"Where can I collect my badge?"*.
- **Multilingual Support**: Foreign or regional attendees can speak in **Hindi (`hi-IN`)**, **Spanish (`es-ES`)**, or **English (`en-IN`/`en-US`)**, and receive spoken answers in their preferred language.
- **Hands-Free Information**: Attendees on mobile devices or kiosk stations can simply tap the mic or speak without typing.

### Injecting Dynamic Event Knowledge into the Assistant
In `backend/server.js`, inject your event database/schedule into the system prompt:

```javascript
// Example: Dynamic event context fetched from your Event DB (MongoDB / PostgreSQL / Prisma)
const eventDetails = {
  name: "TechX Global Summit 2026",
  venue: "Convention Center, Pragati Maidan, New Delhi",
  wifi: { ssid: "TechX_Guest", pass: "Summit2026" },
  stages: [
    { name: "Main Stage (Hall 1)", current: "Keynote on GenAI by Dr. Sharma at 10:00 AM" },
    { name: "Track B (Hall 4)", current: "Cloud Architecture Workshop at 11:30 AM" },
  ],
  registrationDesk: "Counter 4 near Gate 2 (Open 8:30 AM to 5:00 PM)",
  lunchTime: "1:00 PM to 2:30 PM at Banquet Hall B",
  helpdeskPhone: "+91-9876543210 or Extension 402",
};

// Formulate Voice-Optimized System Prompt:
function buildEventVoicePrompt(event) {
  return `You are the live voice concierge for ${event.name}.
Event Information:
- Venue: ${event.venue}
- Wi-Fi: Network "${event.wifi.ssid}", Password "${event.wifi.pass}"
- Keynote & Sessions: ${event.stages.map(s => `${s.name}: ${s.current}`).join("; ")}
- Registration & Badges: ${event.registrationDesk}
- Lunch & Dining: ${event.lunchTime}
- Emergency / Helpdesk: ${event.helpdeskPhone}

STRICT VOICE RULES:
1. FRONT-LOAD THE ANSWER: Put the location, time, or direct fact in your very first sentence (<12 words).
2. STRICT BREVITY: Maximum 1 to 3 short sentences total (<40 words).
3. PURE SPOKEN TEXT: Never use markdown, bullet points, asterisks, URLs, or emojis.
4. ZERO FILLER: Do not say "Sure", "Here is", or "As an AI". Answer immediately.
5. NUMBERS AS WORDS: Write numbers and symbols phonetically (e.g., 'Hall four', 'ten thirty AM').`;
}
```

---

## 🌐 Dual-Language Architecture (STT vs TTS)

The voice assistant provides **two completely independent controls** in the UI:

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│  🎤 STT (Mic Input Language)        │       │  🔊 TTS (Voice Output Language)     │
│  [ Hindi (hi-IN) ▾ ]                │       │  [ English (India - en-IN) ▾ ]       │
└──────────────────┬───────────────────┘       └──────────────────┬───────────────────┘
                   │                                              │
         Microphone transcribes                         LLM & Voice Synthesizer
         in native Hindi script                         respond in English
                   │                                              │
                   └──────────────────► [ Cross-Lingual ] ◄───────┘
                                          Translation
```

### 1. `STT (Mic)` — Speech-to-Text Language (`sttLanguage`)
- **Controls**: Which language the browser's Web Speech API microphone listens for.
- **Supported Languages**:
  - `en-IN`: English (India)
  - `hi-IN`: Hindi (हिन्दी) — Transcribes in Devanagari script
  - `en-US`: English (US)
  - `es-ES`: Spanish (Español)
  - `fr-FR`: French (Français)
  - `de-DE`: German (Deutsch)
  - `ta-IN`: Tamil (தமிழ்)
  - `te-IN`: Telugu (తెలుగు)
  - `bn-IN`: Bengali (বাংলা)
  - `ja-JP`: Japanese (日本語)
- **Live Hot-Switching**: If the microphone is active, changing this dropdown restarts the speech recognition engine immediately without page reloads.

### 2. `TTS (Voice)` — Text-to-Speech Language (`ttsLanguage`)
- **Controls**: Which language the AI assistant replies in and which speech synthesizer voice reads the audio aloud.
- **Modes**:
  - `auto`: Automatically matches the input language (e.g. attendee speaks Hindi &rarr; assistant replies in Hindi).
  - **Fixed Language (`hi-IN`, `en-IN`, `es-ES`, etc.)**: Acts as a spoken translator. For example, attendee speaks Hindi, but TTS is set to English &rarr; assistant explains the answer in English.

---

## ⚡ Latency & Streaming Sentence Queue Pipeline

Traditional voice assistants wait for the full LLM response before generating speech (3-5 second delay). **Aura Voice AI eliminates this latency**:

```
[1. User Speaks]
      │
      ▼ (Hands-free 1.2s silence detection or "Send Now")
[2. POST /api/ask-stream]
      │
      ▼ Groq llama-3.1-8b-instant streams tokens via SSE (<200ms)
[3. Sentence Splitter (RegEx on '.', '?', '!', '।')]
      │
      ├───► Sentence 1 Complete ──► [Plays IMMEDIATELY via useSpeech]
      │
      └───► Sentence 2..N Queued ──► [Buffered in queueRef]
                                           │
                                           ▼ (Sentence 1 finishes)
                                     [50ms Settle Buffer]
                                           │
                                           ▼
                                     [Plays Sentence 2]
```

---

## 🛠️ Step-by-Step Copy-Paste Implementation

To copy this into your Event Management project:

### A. Backend Integration

1. **Install Dependencies** in your backend:
   ```bash
   npm install express cors dotenv groq-sdk @google/genai
   ```

2. **Add Environment Variables** in your `.env`:
   ```env
   PORT=5000
   GROQ_API_KEY=gsk_your_groq_api_key_here
   # Optional fallback if Groq key expires:
   GEMINI_API_KEY=your_gemini_api_key_here
   GROQ_MODEL=llama-3.1-8b-instant
   ```

3. **Backend Route Handler** (copy into your Express server or Next.js route handler):
   ```javascript
   import express from 'express';
   import cors from 'cors';
   import dotenv from 'dotenv';
   import Groq from 'groq-sdk';

   dotenv.config();
   const app = express();
   app.use(cors());
   app.use(express.json());

   const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

   const LANGUAGE_MAP = {
     'hi-IN': 'Hindi (in Devanagari script for speech)',
     'en-IN': 'English (Indian context)',
     'en-US': 'English',
     'es-ES': 'Spanish',
     'fr-FR': 'French',
     'de-DE': 'German',
     'ta-IN': 'Tamil',
     'te-IN': 'Telugu',
     'bn-IN': 'Bengali',
     'ja-JP': 'Japanese',
   };

   app.post('/api/ask-stream', async (req, res) => {
     const { prompt, targetLanguage } = req.body;
     if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache, no-transform');
     res.setHeader('Connection', 'keep-alive');
     res.setHeader('X-Accel-Buffering', 'no');

     let systemPrompt = `You are an event voice concierge. Answer directly in 1 to 2 short spoken sentences (<30 words). Never use markdown or bullet points.`;
     if (targetLanguage && LANGUAGE_MAP[targetLanguage]) {
       systemPrompt += `\nMANDATORY LANGUAGE: Reply strictly in ${LANGUAGE_MAP[targetLanguage]}.`;
     }

     try {
       const stream = await groq.chat.completions.create({
         model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
         messages: [
           { role: 'system', content: systemPrompt },
           { role: 'user', content: prompt.trim() },
         ],
         stream: true,
         max_tokens: 150,
         temperature: 0.4,
       });

       for await (const chunk of stream) {
         const text = chunk.choices[0]?.delta?.content || '';
         if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
       }
       res.write('data: [DONE]\n\n');
       res.end();
     } catch (err) {
       res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
       res.end();
     }
   });
   ```

---

### B. Frontend Integration

1. **Install Dependencies** in your React / Vite / Next.js frontend:
   ```bash
   npm install react-speech-recognition react-text-to-speech lucide-react regenerator-runtime
   ```

2. **Import Regenerator Polyfill** at the top of your component or `main.jsx`:
   ```javascript
   import 'regenerator-runtime/runtime';
   ```

3. **Core Hook Configuration** (copy from `frontend/src/App.jsx`):
   ```javascript
   import { useSpeech, useVoices } from 'react-text-to-speech';
   import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

   // Dynamic voice resolution (prevents voiceURI crashes):
   const { voices } = useVoices();
   const resolvedVoice = useMemo(() => {
     if (!voices || voices.length === 0) return null;
     const target = ttsLanguage === 'auto' ? sttLanguage : ttsLanguage;
     const prefix = target.split('-')[0].toLowerCase();
     return (
       voices.find(v => v.lang?.toLowerCase().startsWith(prefix)) ||
       voices.find(v => v.default) ||
       voices[0]
     );
   }, [voices, ttsLanguage, sttLanguage]);

   // Queue advancement with 50ms Chromium settle buffer:
   const advanceTimerRef = useRef(null);
   const handleSentenceStop = useCallback(() => {
     if (isMutedRef.current) return;
     if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

     advanceTimerRef.current = setTimeout(() => {
       if (queueRef.current.length > 0) {
         const next = queueRef.current.shift();
         setCurrentSentence(prev => (prev === next ? `${next} ` : next));
       } else {
         setCurrentSentence('');
       }
     }, 50);
   }, []);

   // Robust useSpeech configuration:
   const { speechStatus, stop: stopSpeechHook } = useSpeech({
     text: currentSentence,
     rate: 1.12,
     autoPlay: Boolean(currentSentence?.trim()),
     preserveUtteranceQueue: true,
     stableText: true,
     lang: resolvedVoice?.lang || 'en-IN',
     voiceURI: resolvedVoice?.voiceURI,
     onStop: handleSentenceStop,
     onError: (err) => {
       console.warn('TTS Notice:', err);
       // NOTE: Never call handleSentenceStop() here; onStop already handles it!
     },
   });
   ```

---

## ⚠️ Critical AGY Session Gotchas (Past Bugs & Solutions)

> [!CAUTION]
> If an AI agent or developer modifies the voice hooks, they **must NOT** make these four mistakes:

| Mistake | What Happens | The Correct Fix |
| :--- | :--- | :--- |
| **Hardcoding `voiceURI: "Google हिन्दी"`** | On Windows/macOS/Edge, this proprietary voice doesn't exist. Web Speech API throws `error: "language-unavailable"` and audio dies. | Use `useVoices()` to discover installed voices at runtime. Fall back to `v.default` if a specific language voice isn't present. |
| **Calling `handleSentenceStop()` in `onError`** | In `react-text-to-speech`, `utterance.onerror` already triggers `onStop`. Calling it in `onError` causes a **double-advance**, skipping all queued sentences in 10ms. | Only call `console.warn` inside `onError`. Allow `onStop` to advance the queue. |
| **Omitting the 50ms Settle Buffer** | Chromium leaves `window.speechSynthesis.speaking = true` for ~20ms after `onend`. Auto-playing the next sentence immediately causes `cancel()`, terminating consecutive sentences. | Wrap queue advancement in `setTimeout(..., 50)` inside `handleSentenceStop()`. |
| **Setting `preserveUtteranceQueue: false`** | When new tokens stream, the library cancels active speech instead of sequencing it. | Always keep `preserveUtteranceQueue: true`. |

---

## 📡 Backend API Specifications

### `POST /api/ask-stream`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "prompt": "Where is the keynote stage?",
    "targetLanguage": "hi-IN"
  }
  ```
- **Response**: `text/event-stream`
  ```
  data: {"text":"मुख्य"}
  data: {"text":" मंच"}
  data: {"text":" हॉल पांच में है।"}
  data: [DONE]
  ```

### `GET /api/health`
- **Response**:
  ```json
  {
    "status": "ok",
    "provider": "groq",
    "model": "llama-3.1-8b-instant",
    "groqConfigured": true,
    "apiKeyConfigured": true
  }
  ```

---

## 🧪 Verification & Testing Checklist

When running in your Event Management project, verify with these steps:

- [ ] **English STT & TTS**: Select `STT: en-IN`, `TTS: en-IN`. Speak *"What is the speed of light?"* &rarr; Assistant transcribes in English and replies in spoken English.
- [ ] **Hindi STT & TTS**: Select `STT: hi-IN`, `TTS: hi-IN`. Speak *"भारत की राजधानी क्या है?"* &rarr; Assistant transcribes in Devanagari Hindi and replies in spoken Hindi.
- [ ] **Cross-Lingual Translation**: Select `STT: en-IN`, `TTS: hi-IN`. Speak *"What is the capital of Australia?"* &rarr; Assistant transcribes in English, but replies aloud in Hindi (*"ऑस्ट्रेलिया की राजधानी कैनबरा है।"*).
- [ ] **Sentence Sequencing**: Ask a longer query (e.g. *"Explain how clouds form"*). Verify that sentence 1 plays, followed by sentence 2 without pauses or cutoffs.
- [ ] **Mute/Stop**: Click **"Mute / Stop"** during speech &rarr; Audio cancels immediately and the queue clears.
