import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { bots } from "@/db/schema"

// One of the signed-in user's bots, or undefined if it doesn't exist or
// belongs to someone else
export async function getBotById(botId: string) {
  const { userId } = await auth.protect()

  return db.query.bots.findFirst({
    where: and(eq(bots.id, botId), eq(bots.userId, userId)),
  })
}

// The signed-in user's bots, oldest first
export async function getUserBots() {
  const { userId } = await auth.protect()

  return db.query.bots.findMany({
    where: eq(bots.userId, userId),
    orderBy: asc(bots.createdAt),
  })
}
