"use client"

import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { isToolUIPart, type ToolUIPart } from "ai"
import { ArrowRightLeftIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { ChatAvatar } from "@/components/chat-avatar"
import { Badge } from "@/components/ui/badge"
import { Image } from "@/components/ai-elements/image"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import type { Bot } from "@/db/schema"
import type { aiChat, ChatTools, ChatUIMessage } from "@/trigger/chat"

type Transport = ReturnType<typeof useTriggerChatTransport<typeof aiChat>>

type ChatToolPart = ToolUIPart<ChatTools>

// Plain-language names for the tool call headers
const toolTitles: Record<ChatToolPart["type"], string> = {
  "tool-bash": "Run command",
  "tool-readFile": "Read file",
  "tool-writeFile": "Write file",
  "tool-listFiles": "List files",
  "tool-mouseClick": "Click",
  "tool-mouseMove": "Move mouse",
  "tool-mouseScroll": "Scroll",
  "tool-keyboardType": "Type",
  "tool-keyboardPress": "Press key",
  "tool-viewScreen": "Look at screen",
  "tool-showScreen": "Show screen",
  "tool-handoff": "Hand off",
}

function ToolCall({ part }: { part: ChatToolPart }) {
  const title = toolTitles[part.type]

  // A group chat bot passing the message on: one line saying to whom and why
  if (part.type === "tool-handoff" && part.state === "output-available") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowRightLeftIcon className="size-3.5 shrink-0" />
        Handed off to {part.output.name}: {part.output.reason}
      </p>
    )
  }

  // The screenshot is for the agent only, so just show that it looked
  if (part.type === "tool-viewScreen") {
    return (
      <Tool>
        <ToolHeader type={part.type} state={part.state} title={title} />
      </Tool>
    )
  }

  if (part.type === "tool-showScreen") {
    return (
      <Tool defaultOpen>
        <ToolHeader type={part.type} state={part.state} title={title} />
        <ToolContent>
          {part.state === "output-available" ? (
            <Image
              base64={part.output.data}
              mediaType={part.output.mediaType}
              uint8Array={new Uint8Array()}
              alt="Screenshot of the agent's desktop"
            />
          ) : (
            <ToolOutput output={undefined} errorText={part.errorText} />
          )}
        </ToolContent>
      </Tool>
    )
  }

  return (
    <Tool>
      <ToolHeader type={part.type} state={part.state} title={title} />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput output={part.output} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  )
}

// A message's content, with its bot's face beside it when it has one
function ChatMessageRow({
  bot,
  children,
}: {
  bot: Bot | undefined
  children: ReactNode
}) {
  if (!bot) return children
  return (
    <div className="flex gap-3">
      <ChatAvatar seed={bot.avatar} className="size-6" />
      {children}
    </div>
  )
}

// `bots` are the bots a group chat can talk to; empty for a direct chat,
// whose agent always answers as its only bot
function Chat({ id, bots }: { id: string; bots: Bot[] }) {
  const [botId, setBotId] = useState(bots[0]?.id)
  const transport = useTriggerChatTransport<typeof aiChat>({
    task: "ai-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    // Sent with every message, and kept current as the picker changes, so
    // each turn is answered by the bot picked when it was sent
    clientData: { botId },
  })
  // Seeds the transport's resume cursor along with the saved messages
  const { messages, isLoading } = useLoadTranscript(id, loadTranscript, {
    transport,
  })

  // useChat must mount with the loaded transcript as its initial messages
  if (isLoading) return <div className="flex-1" />

  // The transcript store is untyped; it holds messages this agent wrote
  return (
    <ChatView
      id={id}
      initialMessages={messages as ChatUIMessage[]}
      transport={transport}
      bots={bots}
      botId={botId}
      onBotIdChange={setBotId}
    />
  )
}

function ChatView({
  id,
  initialMessages,
  transport,
  bots,
  botId,
  onBotIdChange,
}: {
  id: string
  initialMessages: ChatUIMessage[]
  transport: Transport
  bots: Bot[]
  botId: string | undefined
  onBotIdChange: (botId: string) => void
}) {
  const { messages, sendMessage, status, stop } = useChat({
    id,
    messages: initialMessages,
    transport,
    // After a handoff, keep talking to the bot that took over
    onFinish: ({ message }) => {
      const replyBotId = message.metadata?.botId
      if (replyBotId && bots.some((bot) => bot.id === replyBotId)) {
        onBotIdChange(replyBotId)
      }
    },
  })

  function handleSubmit({ text }: PromptInputMessage) {
    if (!text.trim()) return
    // Saved on the message, so it keeps showing which bot it was for
    sendMessage({ text, metadata: { botId } })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-4xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Type a message below to begin"
            />
          ) : (
            messages.map((message) => {
              // In a group chat: the bot a reply is from, or the bot a
              // message was sent to. Empty for messages from before bots
              // were recorded, and always in a direct chat
              const messageBot = bots.find(
                (bot) => bot.id === message.metadata?.botId
              )

              return (
                <Message from={message.role} key={message.id}>
                  <ChatMessageRow
                    bot={message.role === "assistant" ? messageBot : undefined}
                  >
                    <MessageContent>
                      {message.role === "user" && messageBot ? (
                        // The badge and the first paragraph render inline, so
                        // the bot reads as tagged at the start of the first
                        // line (a float breaks the bubble's fit-content width)
                        <div className="[&>div:nth-child(2)]:inline [&>div:nth-child(2)>*:first-child]:inline">
                          <Badge
                            variant="outline"
                            className="mr-1.5 max-w-40 pl-0.5 align-top"
                          >
                            <ChatAvatar
                              seed={messageBot.avatar}
                              className="size-4 shrink-0"
                            />
                            <span className="truncate">{messageBot.name}</span>
                          </Badge>
                          {message.parts.map((part, i) =>
                            part.type === "text" ? (
                              <MessageResponse key={i}>{part.text}</MessageResponse>
                            ) : null
                          )}
                        </div>
                      ) : (
                        message.parts.map((part, i) => {
                          if (part.type === "text") {
                            return (
                              <MessageResponse key={i}>
                                {part.text}
                              </MessageResponse>
                            )
                          }
                          if (
                            isToolUIPart(part) &&
                            part.type !== "dynamic-tool"
                          ) {
                            return (
                              <ToolCall key={part.toolCallId} part={part} />
                            )
                          }
                          return null
                        })
                      )}
                    </MessageContent>
                  </ChatMessageRow>
                </Message>
              )
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-4xl shrink-0 p-4 pt-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {bots.length > 0 && (
                // Which of the group's bots answers the next message
                <PromptInputSelect
                  value={botId}
                  onValueChange={(value) => {
                    if (typeof value === "string") onBotIdChange(value)
                  }}
                >
                  <PromptInputSelectTrigger aria-label="Bot to talk to">
                    <PromptInputSelectValue>
                      {(value: string) => {
                        const bot = bots.find((bot) => bot.id === value)
                        return (
                          bot && (
                            <>
                              <ChatAvatar
                                seed={bot.avatar}
                                className="size-4"
                              />
                              {bot.name}
                            </>
                          )
                        )
                      }}
                    </PromptInputSelectValue>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {bots.map((bot) => (
                      <PromptInputSelectItem key={bot.id} value={bot.id}>
                        <ChatAvatar seed={bot.avatar} className="size-4" />
                        {bot.name}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              )}
            </PromptInputTools>
            <PromptInputSubmit
              status={status}
              onStop={stop}
              className="ml-auto"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export { Chat }
