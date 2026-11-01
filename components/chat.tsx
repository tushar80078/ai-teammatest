"use client"

import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { isToolUIPart, type InferUITools, type ToolUIPart } from "ai"

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
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import type { aiChat, ChatUIMessage } from "@/trigger/chat"
import type { createComputerTools } from "@/trigger/computer-tools"

type Transport = ReturnType<typeof useTriggerChatTransport<typeof aiChat>>

type ChatToolPart = ToolUIPart<
  InferUITools<ReturnType<typeof createComputerTools>>
>

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
}

function ToolCall({ part }: { part: ChatToolPart }) {
  const title = toolTitles[part.type]

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

function Chat({ id }: { id: string }) {
  const transport = useTriggerChatTransport<typeof aiChat>({
    task: "ai-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
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
    />
  )
}

function ChatView({
  id,
  initialMessages,
  transport,
}: {
  id: string
  initialMessages: ChatUIMessage[]
  transport: Transport
}) {
  const { messages, sendMessage, status, stop } = useChat({
    id,
    messages: initialMessages,
    transport,
  })

  function handleSubmit({ text }: PromptInputMessage) {
    if (!text.trim()) return
    sendMessage({ text })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Type a message below to begin"
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      )
                    }
                    if (isToolUIPart(part) && part.type !== "dynamic-tool") {
                      return <ToolCall key={part.toolCallId} part={part} />
                    }
                    return null
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export { Chat }
