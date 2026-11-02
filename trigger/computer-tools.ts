import { Daytona, DaytonaFileNotFoundError, type Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

import { MEMORY_FILE } from "@/lib/bot-memory"

// Created on first use so importing this file never needs the env vars. The
// endpoint is passed explicitly: the SDK refuses to pick it up implicitly
// when it also appears in .env.local
let daytona: Daytona | undefined
function getDaytona() {
  daytona ??= new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL,
  })
  return daytona
}

// The bot's memory file, read for its system prompt every turn: starts the
// sandbox if it auto-stopped. A missing file (bots made before memory
// existed) reads as empty; any other failure throws, so the caller can tell
// "nothing remembered" from "memory unavailable"
export async function readMemoryFile(sandboxId: string) {
  const sandbox = await getDaytona().get(sandboxId)
  if (sandbox.state !== "started") await sandbox.start()
  try {
    const content = await sandbox.fs.downloadFile(MEMORY_FILE)
    return truncate(content.toString("utf8").trim())
  } catch (error) {
    if (error instanceof DaytonaFileNotFoundError) return ""
    throw error
  }
}

// Long command output and files are cut so one call can't flood the context
const MAX_OUTPUT_CHARS = 20_000

function truncate(text: string) {
  return text.length > MAX_OUTPUT_CHARS
    ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n… [truncated ${text.length - MAX_OUTPUT_CHARS} characters]`
    : text
}

type Screenshot = { mediaType: string; data: string }

// The model sees the screenshot as an image, not as base64 text, plus a note
// saying who else saw it, so it knows whether the person already has it
function screenshotToModelOutput(note: string) {
  return ({ output }: { output: Screenshot }) => ({
    type: "content" as const,
    value: [
      { type: "text" as const, text: note },
      {
        type: "file" as const,
        mediaType: output.mediaType,
        data: { type: "data" as const, data: output.data },
      },
    ],
  })
}

// Tools that drive one sandbox. `getSandboxId` is only called on the first
// tool call of a turn, so turns without tool calls never touch Daytona
// `getSandboxId` can change mid-turn (a group chat handoff), so sandboxes are
// cached per ID and each call reaches whichever bot is answering now
export function createComputerTools(getSandboxId: () => Promise<string>) {
  const sandboxes = new Map<string, Promise<Sandbox>>()
  const desktops = new Map<string, Promise<Sandbox>>()

  // The sandbox auto-stops when idle, so start it again if needed
  async function getSandbox() {
    const id = await getSandboxId()
    let sandbox = sandboxes.get(id)
    if (!sandbox) {
      sandbox = (async () => {
        const found = await getDaytona().get(id)
        if (found.state !== "started") await found.start()
        return found
      })()
      sandboxes.set(id, sandbox)
    }
    return sandbox
  }

  // The desktop processes don't survive a sandbox stop, so start them too
  async function getDesktop() {
    const id = await getSandboxId()
    let desktop = desktops.get(id)
    if (!desktop) {
      desktop = (async () => {
        const found = await getSandbox()
        const { status } = await found.computerUse.getStatus()
        if (status !== "active") await found.computerUse.start()
        return found
      })()
      desktops.set(id, desktop)
    }
    return desktop
  }

  async function takeScreenshot(): Promise<Screenshot> {
    const found = await getDesktop()
    const { screenshot } = await found.computerUse.screenshot.takeCompressed({
      format: "jpeg",
      quality: 80,
      showCursor: true,
    })
    if (!screenshot) throw new Error("The screenshot came back empty")
    return { mediaType: "image/jpeg", data: screenshot }
  }

  const point = {
    x: z.number().int().min(0).describe("Pixels from the left of the screen"),
    y: z.number().int().min(0).describe("Pixels from the top of the screen"),
  }

  return {
    bash: tool({
      description:
        "Run a shell command in your sandbox and get its exit code and output. Commands time out after 2 minutes. GUI apps started here open on your desktop; start them in the background with output redirected so the command returns, e.g. `chromium --no-sandbox https://example.com > /tmp/chromium.log 2>&1 &`.",
      inputSchema: z.object({
        command: z.string().describe("The command to run"),
        cwd: z
          .string()
          .optional()
          .describe("Working directory; defaults to your home directory"),
      }),
      execute: async ({ command, cwd }) => {
        const found = await getSandbox()
        // The API fails with a misleading "no such file" for a missing cwd, so
        // cd in the shell instead, where a bad path gets a readable error
        const script = cwd
          ? `cd '${cwd.replaceAll("'", `'\\''`)}' && ${command}`
          : command
        const { exitCode, result } = await found.process.executeCommand(
          script,
          undefined,
          { DISPLAY: ":0" },
          120
        )
        return { exitCode, output: truncate(result) }
      },
    }),

    readFile: tool({
      description: "Read a text file from your sandbox.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const found = await getSandbox()
        const content = await found.fs.downloadFile(path)
        return truncate(content.toString("utf8"))
      },
    }),

    writeFile: tool({
      description:
        "Create or overwrite a text file in your sandbox. Parent folders must exist.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        const found = await getSandbox()
        await found.fs.uploadFile(Buffer.from(content, "utf8"), path)
        return `Wrote ${content.length} characters to ${path}`
      },
    }),

    listFiles: tool({
      description: "List the files and folders in a folder of your sandbox.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const found = await getSandbox()
        const files = await found.fs.listFiles(path)
        return files.map(({ name, isDir, size }) => ({ name, isDir, size }))
      },
    }),

    mouseClick: tool({
      description:
        "Click at a point on your desktop. Look at the screen first so you know where to click.",
      inputSchema: z.object({
        ...point,
        button: z.enum(["left", "right", "middle"]).default("left"),
        double: z.boolean().default(false).describe("Double-click"),
      }),
      execute: async ({ x, y, button, double }) => {
        const found = await getDesktop()
        await found.computerUse.mouse.click(x, y, button, double)
        return `Clicked ${button} at ${x}, ${y}`
      },
    }),

    mouseMove: tool({
      description: "Move the mouse pointer to a point on your desktop.",
      inputSchema: z.object(point),
      execute: async ({ x, y }) => {
        const found = await getDesktop()
        await found.computerUse.mouse.move(x, y)
        return `Moved to ${x}, ${y}`
      },
    }),

    mouseScroll: tool({
      description: "Scroll the mouse wheel at a point on your desktop.",
      inputSchema: z.object({
        ...point,
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(3)
          .describe("Wheel ticks"),
      }),
      execute: async ({ x, y, direction, amount }) => {
        const found = await getDesktop()
        await found.computerUse.mouse.scroll(x, y, direction, amount)
        return `Scrolled ${direction} ${amount} at ${x}, ${y}`
      },
    }),

    keyboardType: tool({
      description:
        "Type text into whatever has focus on your desktop. Newlines press Enter.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        const found = await getDesktop()
        await found.computerUse.keyboard.type(text)
        return `Typed ${text.length} characters`
      },
    }),

    keyboardPress: tool({
      description:
        "Press one key on your desktop, optionally with modifiers, e.g. enter, escape, tab, backspace, up, f5, or c with ctrl.",
      inputSchema: z.object({
        key: z.string(),
        modifiers: z.array(z.enum(["ctrl", "alt", "shift", "cmd"])).default([]),
      }),
      execute: async ({ key, modifiers }) => {
        const found = await getDesktop()
        await found.computerUse.keyboard.press(key, modifiers)
        return `Pressed ${[...modifiers, key].join("+")}`
      },
    }),

    viewScreen: tool({
      description:
        "Take a screenshot of your desktop for yourself, to see the result of an action or find where to click. The person you work for doesn't see it.",
      inputSchema: z.object({}),
      execute: takeScreenshot,
      toModelOutput: screenshotToModelOutput(
        "Screenshot of your desktop. Only you can see it; the person you work for does not."
      ),
    }),

    showScreen: tool({
      description:
        "Take a screenshot of your desktop and display it to the person you work for, as an image in the chat. This is the only way to show them a screenshot: call it whenever they ask for a screenshot or to see your screen.",
      inputSchema: z.object({}),
      execute: takeScreenshot,
      toModelOutput: screenshotToModelOutput(
        "This screenshot is now displayed as an image in the chat, and the person you work for can see it. Don't describe it unless they ask."
      ),
    }),
  }
}
