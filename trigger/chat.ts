import { openai } from "@ai-sdk/openai"
import { chat } from "@trigger.dev/sdk/ai"

// No `storage` set, so the transcript lives in the platform's default
// storage, keyed by chat id
export const aiChat = chat.agent({
  id: "ai-chat",
  // `streamText` comes from the run argument, not from "ai"
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: openai("gpt-5.4-mini"),
      messages,
      abortSignal: signal,
    }),
})
