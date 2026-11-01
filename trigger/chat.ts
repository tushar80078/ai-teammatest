import { openai } from "@ai-sdk/openai"
import { chat, type InferChatUIMessageFromTools } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats, type Bot } from "@/db/schema"
import { createComputerTools } from "@/trigger/computer-tools"

// The bot of a direct chat, its only member
async function getChatBot(chatId: string) {
  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        limit: 1,
        with: { bot: true },
      },
    },
  })
  const bot = chat?.members[0]?.bot
  if (!bot) throw new Error(`No bot found for chat ${chatId}`)
  return bot
}

// Who the bot is, where it lives, and how to work its computer
function buildSystemPrompt(bot: Bot) {
  return [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    bot.instructions &&
      `Instructions from the person you work for:\n${bot.instructions}`,
    `You have your own sandbox: an isolated Linux machine in the cloud with a desktop, created for you alone and deleted along with you. You can run commands, work with files, and use the desktop with the mouse and keyboard.`,
    `The desktop is 1024x768 pixels, with 0,0 at the top left. Before you click or type, use viewScreen to see where things are, and use it again afterwards to check what happened. Only showScreen puts an image in the chat: whenever the person asks for a screenshot or to see your screen, call showScreen. Never save screenshots to files or say the chat can't display images.`,
    `The desktop's own browser launcher is broken, so don't click it. To open a website, start Chromium with bash in the background, e.g. \`chromium --no-sandbox https://www.google.com > /tmp/chromium.log 2>&1 &\`, wait a few seconds, then look at the screen. If \`chromium\` isn't found, try \`chromium-browser\`.`,
    `Stay in character as ${bot.name} and keep your answers focused on your job.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

// Messages with typed tool parts, so the chat UI can render each tool
export type ChatUIMessage = InferChatUIMessageFromTools<
  ReturnType<typeof createComputerTools>
>

// No `storage` set, so the transcript lives in the platform's default
// storage, keyed by chat id
export const aiChat = chat.withUIMessage<ChatUIMessage>().agent({
  id: "ai-chat",
  // Declared here too so screenshots stay images on later turns
  tools: ({ chatId }) =>
    createComputerTools(async () => {
      const bot = await getChatBot(chatId)
      if (!bot.sandboxId) throw new Error("This bot has no sandbox")
      return bot.sandboxId
    }),
  // `streamText` comes from the run argument, not from "ai"
  run: async ({ chatId, messages, tools, signal, streamText }) => {
    // Read every turn so edits to the bot apply to the next message
    const bot = await getChatBot(chatId)

    return streamText({
      model: openai("gpt-5.4-mini"),
      system: buildSystemPrompt(bot),
      messages,
      tools,
      abortSignal: signal,
      // Computer use takes many look-act steps per answer
      stopWhen: stepCountIs(30),
    })
  },
})
