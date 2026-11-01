"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { refresh, revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { nanoid } from "nanoid"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  insertBotSchema,
  type Bot,
  type Chat,
  type InsertBot,
} from "@/db/schema"
import { createBotSandbox, deleteBotSandbox } from "@/lib/daytona"

type CreateBotResult = { bot: Bot; chat: Chat } | { error: string }

// Creates the bot's sandbox, then the bot together with its direct chat and
// membership, atomically; the sandbox is deleted again if the insert fails
export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Check the bot details and try again." }
  }

  const botId = nanoid()

  let sandboxId: string
  try {
    sandboxId = await createBotSandbox(botId, userId)
  } catch (error) {
    console.error("Failed to create bot sandbox", error)
    return { error: "Couldn't set up the bot's sandbox. Try again." }
  }

  let result: { bot: Bot; chat: Chat }
  try {
    result = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          ...parsed.data,
          instructions: parsed.data.instructions || null,
          id: botId,
          userId,
          sandboxId,
        })
        .returning()

      const [chat] = await tx
        .insert(chats)
        .values({ userId, kind: "direct" })
        .returning()

      await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })

      return { bot, chat }
    })
  } catch (error) {
    await deleteBotSandbox(sandboxId).catch((cleanupError) =>
      console.error("Failed to delete orphaned sandbox", cleanupError)
    )
    throw error
  }
  const { bot, chat } = result

  // Re-render the dashboard layout so the sidebar re-runs getUserChats
  refresh()
  return { bot, chat }
}

type UpdateBotResult = { bot: Bot } | { error: string }

// Updates one of the signed-in user's bots; another user's bot is not found
export async function updateBot(
  botId: string,
  input: InsertBot
): Promise<UpdateBotResult> {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Check the bot details and try again." }
  }

  const [bot] = await db
    .update(bots)
    .set({ ...parsed.data, instructions: parsed.data.instructions || null })
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning()

  if (!bot) {
    return { error: "This bot no longer exists." }
  }

  // Re-render the layout and page so the sidebar and chat header show it
  refresh()
  return { bot }
}

type DeleteBotResult = { error: string }

// Deletes one of the signed-in user's bots along with its direct chats, which
// would otherwise be left with no members, then goes home: the current page
// may be one of those chats
export async function deleteBot(botId: string): Promise<DeleteBotResult> {
  const { userId } = await auth.protect()

  const bot = await db.transaction(async (tx) => {
    const directChats = await tx
      .select({ id: chats.id })
      .from(chats)
      .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .where(
        and(
          eq(chatMembers.botId, botId),
          eq(chats.userId, userId),
          eq(chats.kind, "direct")
        )
      )

    const [bot] = await tx
      .delete(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .returning()
    if (!bot) return undefined

    if (directChats.length > 0) {
      await tx.delete(chats).where(
        inArray(
          chats.id,
          directChats.map((chat) => chat.id)
        )
      )
    }
    return bot
  })

  if (!bot) {
    return { error: "This bot no longer exists." }
  }

  // The bot is already gone, so a failed sandbox delete is logged, not shown
  if (bot.sandboxId) {
    await deleteBotSandbox(bot.sandboxId).catch((error) =>
      console.error("Failed to delete bot sandbox", error)
    )
  }

  revalidatePath("/", "layout")
  redirect("/")
}
