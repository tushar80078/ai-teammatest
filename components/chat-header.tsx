import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import type { UserChat } from "@/queries/chats"

function ChatHeader({ chat }: { chat: UserChat }) {
  // Group chats aren't handled yet; use the first bot to join
  const bot = chat.members[0]?.bot
  const name = chat.name ?? bot?.name ?? "Untitled chat"

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      {bot ? (
        // The bot's face and name open the dialog to edit it
        <BotDialog
          bot={bot}
          trigger={<Button variant="ghost" className="-ml-2.5 min-w-0" />}
        >
          <ChatAvatar seed={bot.avatar} className="size-5" />
          <span className="truncate">{name}</span>
        </BotDialog>
      ) : (
        <>
          <ChatAvatar seed={chat.id} className="size-5" />
          <h1 className="truncate text-sm font-medium">{name}</h1>
        </>
      )}
      <Button variant="ghost" size="icon" className="ml-auto">
        <MonitorIcon />
        <span className="sr-only">Desktop</span>
      </Button>
    </header>
  )
}

export { ChatHeader }
