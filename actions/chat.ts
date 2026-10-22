"use server"

import { auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"

import { getChatById } from "@/queries/chats"
import type { aiChat } from "@/trigger/chat"

const start = chat.createStartSessionAction<typeof aiChat>("ai-chat")
const load = chat.createLoadTranscriptAction(defaultStorage)

// chatId comes from the browser, so every action checks the signed-in user
// owns the chat before touching its session or transcript
async function assertChatOwner(chatId: string) {
  const owned = await getChatById(chatId)
  if (!owned) throw new Error("Chat not found")
}

// Creates the session and its first run; idempotent per chat id
export async function startChatSession(
  params: ChatStartSessionParams<typeof aiChat>
) {
  await assertChatOwner(params.chatId)
  return start(params)
}

// Called by the transport to refresh an expired session token
export async function mintChatAccessToken(chatId: string) {
  await assertChatOwner(chatId)
  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

// Reads the saved conversation so the chat renders its history on load
export async function loadTranscript(params: Parameters<typeof load>[0]) {
  await assertChatOwner(params.chatId)
  return load(params)
}
