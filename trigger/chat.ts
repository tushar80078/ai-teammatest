import { openai } from "@ai-sdk/openai"
import { chat } from "@trigger.dev/sdk/ai"
import {
  stepCountIs,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { chatMembers, chats, type Bot } from "@/db/schema"
import { MEMORY_FILE } from "@/lib/bot-memory"
import { createComputerTools, readMemoryFile } from "@/trigger/computer-tools"
import { createHandoffTool, type Handoff } from "@/trigger/handoff-tool"

// The chat with its bots, and the bot that answers this turn: the one picked
// in a group chat, or a direct chat's only bot. botId comes from the browser,
// so it must be one of the chat's members
async function getTurnContext(chatId: string, botId: string | undefined) {
  const found = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      members: { orderBy: asc(chatMembers.joinedAt), with: { bot: true } },
    },
  })
  const bots = found?.members.map((member) => member.bot) ?? []
  const bot = botId ? bots.find((bot) => bot.id === botId) : bots[0]
  if (!found || !bot) throw new Error(`No bot found for chat ${chatId}`)
  return { chat: found, bots, bot }
}

// The bot answering each chat's current turn, which a handoff changes
// mid-turn; the tools read it to reach the right bot's sandbox
const answering = new Map<string, Bot>()

type GroupContext = {
  name: string
  // Everyone in the group, including the bot the prompt is for
  bots: Bot[]
  // Set when another bot handed this message over
  handoff?: Handoff & { from: Bot }
}

// How a bot behaves in a group chat: who else is there, whose the earlier
// replies are, and when to hand off
function buildGroupPrompt(bot: Bot, group: GroupContext) {
  const others = group.bots
    .filter((other) => other.id !== bot.id)
    .map((other) => `- ${other.name} (id: ${other.id}): ${other.job}`)
    .join("\n")

  return [
    `You are in a group chat called "${group.name}" with the person you work for and these other bots:\n${others}`,
    `The person picks which bot answers each message. Earlier assistant replies in this conversation may have been written by the other bots, not by you, so don't present their work as your own.`,
    `Each bot has its own sandbox. Your tools only reach yours: you can't see the other bots' files or screens.`,
    group.handoff
      ? `${group.handoff.from.name} handed this message to you because: ${group.handoff.reason}. Answer it yourself now; you can't hand it off again.`
      : [
          `Before you answer, compare the message with your job and with each other bot's job. If another bot's job matches the request better than yours, you must call the handoff tool with that bot's id and a one-sentence reason. Call it as your very first action, with no text before or after it: that bot then answers in your place, in this same reply.`,
          `Always hand off when the person asks for something that is another bot's job (for example, a code review when there is a code reviewer bot), or asks whether you're the right bot when another bot fits better. Never just tell the person another bot would be better, and never offer to help anyway: hand off instead.`,
          `Answer yourself only when the request fits your job at least as well as any other bot's.`,
        ].join("\n"),
  ].join("\n\n")
}

// How a bot keeps its memory file. The file is the bot's, shared by every
// chat it's in, so it's how a group chat learns what was said 1:1
// `memory` is the file's current contents, loaded fresh every turn so the
// bot can't skip recalling it; null when it couldn't be read
function buildMemoryPrompt(memory: string | null, group?: GroupContext) {
  return [
    `Your memory is the Markdown file ${MEMORY_FILE} in your sandbox. It's the only thing that carries over between your chats: you're in a private 1:1 chat with the person you work for and may also be in group chats, and none of them can see the others' messages.`,
    memory === null
      ? `Your memory file couldn't be loaded for this message. If the message refers to something not in this conversation, read the file with readFile before answering.`
      : `Everything you remember is in your memory file, whose current contents are below. Treat it as things you know: use it to answer questions about the person, earlier chats, or past work, and never say you don't know something that's in it.\n<memory>\n${memory || "(empty: nothing saved yet)"}\n</memory>`,
    group &&
      `You're in a group chat now, so things the person told you in your private chat won't appear in this conversation; they're in your memory.`,
    `Saving: whenever the person tells you something worth knowing later (facts about them or their work, preferences, decisions, plans, things they ask you to remember, and what you did for them), save it with writeFile before you finish your reply. Write the whole file: its current contents with your changes, so nothing is lost. Keep entries short, grouped under headings, and dated; update or remove entries that are no longer true. Never save secrets such as passwords or API keys. Don't mention the memory file unless asked.`,
  ]
    .filter(Boolean)
    .join("\n")
}

// A bot's memory for its system prompt, or null if the sandbox can't be
// reached, in which case the bot is told to read the file itself
async function loadMemory(bot: Bot) {
  if (!bot.sandboxId) return null
  try {
    return await readMemoryFile(bot.sandboxId)
  } catch (error) {
    console.error(`Failed to load memory for bot ${bot.id}`, error)
    return null
  }
}

// Who the bot is, where it lives, and how to work its computer, plus how to
// behave in a group chat when it's in one
function buildSystemPrompt(
  bot: Bot,
  memory: string | null,
  group?: GroupContext
) {
  return [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    bot.instructions &&
      `Instructions from the person you work for:\n${bot.instructions}`,
    group && buildGroupPrompt(bot, group),
    `You have your own sandbox: an isolated Linux machine in the cloud with a desktop, created for you alone and deleted along with you. You can run commands, work with files, and use the desktop with the mouse and keyboard.`,
    buildMemoryPrompt(memory, group),
    `The desktop is 1024x768 pixels, with 0,0 at the top left. Before you click or type, use viewScreen to see where things are, and use it again afterwards to check what happened. Only showScreen puts an image in the chat: whenever the person asks for a screenshot or to see your screen, call showScreen. Never save screenshots to files or say the chat can't display images.`,
    `The desktop's own browser launcher is broken, so don't click it. To open a website, start Chromium with bash in the background, e.g. \`chromium --no-sandbox https://www.google.com > /tmp/chromium.log 2>&1 &\`, wait a few seconds, then look at the screen. If \`chromium\` isn't found, try \`chromium-browser\`.`,
    `Stay in character as ${bot.name} and keep your answers focused on your job.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

// In a group chat: on a reply, the bot that wrote it (after a handoff, the
// bot that took over); on a person's message, the bot it was sent to
export type ChatMessageMetadata = { botId?: string }

// Every tool the agent can call, typed for the chat UI
export type ChatTools = InferUITools<
  ReturnType<typeof createComputerTools> & ReturnType<typeof createHandoffTool>
>

// Messages with typed tool parts, so the chat UI can render each tool
export type ChatUIMessage = UIMessage<
  ChatMessageMetadata,
  UIDataTypes,
  ChatTools
>

// No `storage` set, so the transcript lives in the platform's default
// storage, keyed by chat id
export const aiChat = chat.withUIMessage<ChatUIMessage>().agent({
  id: "ai-chat",
  // Sent by the chat's composer with every message: which bot to talk to
  clientDataSchema: z.object({ botId: z.string().optional() }),
  // Declared here too so screenshots stay images on later turns. They reach
  // the sandbox of whichever bot is answering, even after a handoff
  tools: ({ chatId, clientData }) =>
    createComputerTools(async () => {
      const bot =
        answering.get(chatId) ??
        (await getTurnContext(chatId, clientData?.botId)).bot
      if (!bot.sandboxId) throw new Error("This bot has no sandbox")
      return bot.sandboxId
    }),
  // `streamText` comes from the run argument, not from "ai"
  run: async ({ chatId, clientData, messages, tools, signal, streamText }) => {
    // Read every turn so edits to the bot, or picking another one in a
    // group chat, apply to the next message
    const {
      chat: room,
      bots,
      bot,
    } = await getTurnContext(chatId, clientData?.botId)
    answering.set(chatId, bot)

    const group: GroupContext | undefined =
      room.kind === "group"
        ? { name: room.name ?? "Group chat", bots }
        : undefined
    let handoff: GroupContext["handoff"]
    // Read before the model starts, so recalling never depends on the bot
    // deciding to open the file
    const memory = await loadMemory(bot)
    // The bot that takes over after a handoff answers from its own memory;
    // loaded once, on the first step after the handoff
    let handoffMemory: Promise<string | null> | undefined

    const turnTools = {
      ...tools,
      ...createHandoffTool(
        bots.filter((other) => other.id !== bot.id),
        ({ bot: to, reason }) => {
          handoff = { bot: to, reason, from: bot }
          answering.set(chatId, to)
        }
      ),
    }
    const toolNames = Object.keys(turnTools) as (keyof typeof turnTools)[]
    // Handoff is only offered in group chats, and only once per turn
    const withoutHandoff = toolNames.filter((name) => name !== "handoff")

    // Stamp the reply with its author; saved with it in the transcript.
    // Read on start and finish, so a handed-off reply ends up the new bot's
    chat.setUIMessageStreamOptions({
      messageMetadata: () =>
        ({
          botId: (answering.get(chatId) ?? bot).id,
        }) satisfies ChatMessageMetadata,
    })

    return streamText({
      model: openai("gpt-5.4-mini"),
      system: buildSystemPrompt(bot, memory, group),
      messages,
      tools: turnTools,
      activeTools: group ? toolNames : withoutHandoff,
      // After a handoff, the next steps are the new bot's: its persona and
      // memory, and no handing the message off again
      prepareStep: async () => {
        if (!handoff || !group) return undefined
        handoffMemory ??= loadMemory(handoff.bot)
        return {
          system: buildSystemPrompt(handoff.bot, await handoffMemory, {
            ...group,
            handoff,
          }),
          activeTools: withoutHandoff,
        }
      },
      abortSignal: signal,
      // Computer use takes many look-act steps per answer
      stopWhen: stepCountIs(30),
    })
  },
})
