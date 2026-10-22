import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { getChatById } from "@/queries/chats"

export default async function ChatPage(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  // Protects the page and scopes the lookup to the signed-in user
  const chat = await getChatById(chatId)
  if (!chat) notFound()

  return (
    <div className="flex h-svh flex-col">
      <ChatHeader chat={chat} />
      <Chat id={chat.id} />
    </div>
  )
}
