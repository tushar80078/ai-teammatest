import "server-only"

import { Daytona, DaytonaNotFoundError } from "@daytona/sdk"

// The endpoint is passed explicitly: the SDK refuses to pick it up implicitly
// when it also appears in .env.local
const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})

// Creates an idle sandbox for a bot; nothing runs in it yet
export async function createBotSandbox(botId: string, userId: string) {
  const sandbox = await daytona.create({ labels: { botId, userId } })
  return sandbox.id
}

// Deletes a bot's sandbox; one that is already gone counts as deleted
export async function deleteBotSandbox(sandboxId: string) {
  try {
    const sandbox = await daytona.get(sandboxId)
    await daytona.delete(sandbox)
  } catch (error) {
    if (error instanceof DaytonaNotFoundError) return
    throw error
  }
}
