import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import {
  DesktopPanelProvider,
  DesktopPanelSlot,
  DesktopPreview,
} from "@/components/desktop-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { getUserBots } from "@/queries/bots"
import { getChatById } from "@/queries/chats"

export default async function ChatPage(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  // Protects the page and scopes the lookup to the signed-in user
  const [chat, bots] = await Promise.all([getChatById(chatId), getUserBots()])
  if (!chat) notFound()

  return (
    <DesktopPanelProvider chatId={chat.id}>
      <ResizablePanelGroup>
        <ResizablePanel id="chat" minSize="30%">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ChatHeader chat={chat} bots={bots} />
            <Chat
              id={chat.id}
              // A group chat's composer picks which of its bots to talk to
              bots={
                chat.kind === "group"
                  ? chat.members.map((member) => member.bot)
                  : []
              }
            />
          </div>
        </ResizablePanel>
        {/* Opened by the desktop button in the chat header */}
        <DesktopPanelSlot>
          <ResizableHandle withHandle />
          <ResizablePanel id="desktop" defaultSize="40%" minSize="20%">
            <DesktopPreview />
          </ResizablePanel>
        </DesktopPanelSlot>
      </ResizablePanelGroup>
    </DesktopPanelProvider>
  )
}
