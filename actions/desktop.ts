"use server"

import { getSandboxDesktopUrl } from "@/lib/daytona"
import { getChatById } from "@/queries/chats"

type DesktopUrlResult = { url: string } | { error: string }

// The VNC URL of the desktop of a chat's bot; the chat must be the signed-in
// user's, since chatId comes from the browser
export async function getDesktopUrl(chatId: string): Promise<DesktopUrlResult> {
  const chat = await getChatById(chatId)
  const sandboxId = chat?.members[0]?.bot.sandboxId
  if (!sandboxId) {
    return { error: "This bot doesn't have a desktop." }
  }

  try {
    return { url: await getSandboxDesktopUrl(sandboxId) }
  } catch (error) {
    console.error("Failed to open bot desktop", error)
    return { error: "Couldn't start the desktop. Try again." }
  }
}
