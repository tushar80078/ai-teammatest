"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { bots, insertBotSchema, type Bot, type InsertBot } from "@/db/schema"

type CreateBotResult = { bot: Bot } | { error: string }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Check the bot details and try again." }
  }

  const [bot] = await db
    .insert(bots)
    .values({
      ...parsed.data,
      instructions: parsed.data.instructions || null,
      userId,
    })
    .returning()

  revalidatePath("/")
  return { bot }
}
