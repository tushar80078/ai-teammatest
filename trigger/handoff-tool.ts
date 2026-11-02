import { tool } from "ai"
import { z } from "zod"

import type { Bot } from "@/db/schema"

export type Handoff = { bot: Bot; reason: string }

// Lets a bot in a group chat pass the person's message to another bot in the
// group, who answers it in the same reply. `bots` are the ones it can hand
// off to; `onHandoff` switches who's answering
export function createHandoffTool(
  bots: Bot[],
  onHandoff: (handoff: Handoff) => void
) {
  return {
    handoff: tool({
      description:
        "Pass the person's message to another bot in this group chat whose job fits it better than yours. Call this whenever another bot is the better fit, instead of telling the person to ask that bot. That bot answers in your place right after this call, so write nothing yourself.",
      inputSchema: z.object({
        botId: z.string().describe("The id of the bot to hand off to"),
        reason: z
          .string()
          .describe("One short sentence on why that bot fits better"),
      }),
      execute: async ({ botId, reason }) => {
        const bot = bots.find((bot) => bot.id === botId)
        if (!bot) throw new Error(`No other bot with id ${botId} in this group`)
        onHandoff({ bot, reason })
        return { botId: bot.id, name: bot.name, reason }
      },
    }),
  }
}
