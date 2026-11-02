"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"
import {
  and,
  eq,
  inArray,
  notInArray,
  TransactionRollbackError,
} from "drizzle-orm"
import { refresh, revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  insertGroupChatSchema,
  type Chat,
  type InsertGroupChat,
} from "@/db/schema"
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

type CreateGroupChatResult = { chat: Chat } | { error: string }

// Creates a group chat with the chosen bots as members, atomically. Only the
// signed-in user's own bots can be added
export async function createGroupChat(
  input: InsertGroupChat
): Promise<CreateGroupChatResult> {
  const { userId } = await auth.protect()

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Check the group details and try again." }
  }
  const { name, botIds } = parsed.data

  const group = await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: bots.id })
      .from(bots)
      .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))
    if (owned.length !== new Set(botIds).size) return undefined

    const [group] = await tx
      .insert(chats)
      .values({ userId, kind: "group", name })
      .returning()

    await tx
      .insert(chatMembers)
      .values(owned.map((bot) => ({ chatId: group.id, botId: bot.id })))

    return group
  })

  if (!group) {
    return { error: "Some of these bots no longer exist." }
  }

  // Re-render the dashboard layout so the sidebar re-runs getUserChats
  refresh()
  return { chat: group }
}

// Renames one of the signed-in user's group chats and sets its bots,
// atomically. Bots that stay keep their place; only the user's own bots can
// be added
export async function updateGroupChat(
  chatId: string,
  input: InsertGroupChat
): Promise<CreateGroupChatResult> {
  const { userId } = await auth.protect()

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Check the group details and try again." }
  }
  const { name, botIds } = parsed.data

  const result = await db
    .transaction(async (tx) => {
      const [group] = await tx
        .update(chats)
        .set({ name })
        .where(
          and(
            eq(chats.id, chatId),
            eq(chats.userId, userId),
            eq(chats.kind, "group")
          )
        )
        .returning()
      if (!group) return { error: "This group chat no longer exists." }

      const owned = await tx
        .select({ id: bots.id })
        .from(bots)
        .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))
      if (owned.length !== new Set(botIds).size) {
        // Throws, undoing the rename too; caught below
        tx.rollback()
      }

      await tx
        .delete(chatMembers)
        .where(
          and(
            eq(chatMembers.chatId, chatId),
            notInArray(chatMembers.botId, botIds)
          )
        )
      await tx
        .insert(chatMembers)
        .values(owned.map((bot) => ({ chatId, botId: bot.id })))
        .onConflictDoNothing()

      return { chat: group }
    })
    .catch((error) => {
      if (error instanceof TransactionRollbackError) {
        return { error: "Some of these bots no longer exist." }
      }
      throw error
    })

  if ("error" in result) return result

  // Re-render the layout and page so the sidebar, header, and composer's bot
  // picker show the change
  refresh()
  return result
}

type DeleteGroupChatResult = { error: string }

// Deletes one of the signed-in user's group chats; its bots stay. Then goes
// home, since the current page is that chat
export async function deleteGroupChat(
  chatId: string
): Promise<DeleteGroupChatResult> {
  const { userId } = await auth.protect()

  const [deleted] = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning({ id: chats.id })

  if (!deleted) {
    return { error: "This group chat no longer exists." }
  }

  revalidatePath("/", "layout")
  redirect("/")
}
