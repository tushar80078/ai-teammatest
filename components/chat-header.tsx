import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import type { Bot } from "@/db/schema"
import type { UserChat } from "@/queries/chats"

// `bots` are all the user's bots, which a group chat's edit dialog picks from
function ChatHeader({ chat, bots }: { chat: UserChat; bots: Bot[] }) {
  // A direct chat has one bot, whose face and name it shows
  const bot = chat.members[0]?.bot
  const name = chat.name ?? bot?.name ?? "Untitled chat"

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      {chat.kind === "group" ? (
        // The group's faces and name open the dialog to edit it
        <GroupChatDialog
          chat={chat}
          bots={bots}
          trigger={<Button variant="ghost" className="-ml-2.5 min-w-0" />}
        >
          <GroupChatAvatar
            seeds={chat.members.map((member) => member.bot.avatar)}
            className="size-5"
          />
          <span className="truncate">{name}</span>
        </GroupChatDialog>
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
