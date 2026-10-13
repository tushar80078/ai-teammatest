import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats } from "@/db/schema"

// The signed-in user's chats, most recent first, with each chat's bots in
// the order they joined
export async function getUserChats() {
  const { userId } = await auth.protect()

  return db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        with: { bot: true },
      },
    },
  })
}

export type UserChat = Awaited<ReturnType<typeof getUserChats>>[number]

// One of the signed-in user's chats with its bots, or undefined if it doesn't
// exist or belongs to someone else
export async function getChatById(chatId: string) {
  const { userId } = await auth.protect()

  return db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        with: { bot: true },
      },
    },
  })
}
