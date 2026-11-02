import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import type { UserChat } from "@/queries/chats"

function ChatHeader({ chat }: { chat: UserChat }) {
  // A direct chat has one bot, whose face and name it shows
  const bot = chat.members[0]?.bot
  const name = chat.name ?? bot?.name ?? "Untitled chat"

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      {chat.kind === "group" ? (
        <>
          <GroupChatAvatar
            seeds={chat.members.map((member) => member.bot.avatar)}
            className="size-5"
          />
          <h1 className="truncate text-sm font-medium">{name}</h1>
        </>
      ) : bot ? (
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
      <DesktopPanelToggle />
    </header>
  )
}

export { ChatHeader }
