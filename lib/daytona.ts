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

// noVNC's web client listens on this port in Daytona's default image
const VNC_PORT = 6080

// A URL that opens the sandbox's desktop in noVNC, starting the sandbox and
// its desktop if needed. The signed URL is scoped to the VNC port only, so it
// can go to the browser, unlike the sandbox-wide preview token
export async function getSandboxDesktopUrl(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId)
  if (sandbox.state !== "started") await sandbox.start()
  const { status } = await sandbox.computerUse.getStatus()
  if (status !== "active") await sandbox.computerUse.start()

  const { url } = await sandbox.getSignedPreviewUrl(VNC_PORT, 60 * 60 * 8)
  return `${url}/vnc.html?autoconnect=true&resize=scale&reconnect=true`
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
