"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { SearchIcon } from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import type { UserChat } from "@/queries/bots"

// The platform never changes, so there is nothing to subscribe to
function subscribe() {
  return () => {}
}

// ⌘ on Apple devices, Ctrl elsewhere; the server renders ⌘
function useIsMac() {
  return useSyncExternalStore(
    subscribe,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true
  )
}

// A search button styled like an Input that opens a command palette of the
// user's chats, also opened with ⌘K / Ctrl+K
function ChatSearch({ chats }: { chats: UserChat[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const isMac = useIsMac()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {/* Input's classes on a ghost Button, so it keeps the button hover */}
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-8 w-full min-w-0 justify-start rounded-lg border border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      >
        <SearchIcon data-icon="inline-start" />
        Search
        <Kbd className="ml-auto">{isMac ? "⌘K" : "Ctrl K"}</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Find a chat by its name"
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => {
                // Group chats aren't handled yet; use the first bot to join
                const bot = chat.members[0]?.bot
                const name = chat.name ?? bot?.name ?? "Untitled chat"

                return (
                  <CommandItem
                    key={chat.id}
                    value={chat.id}
                    keywords={[name]}
                    onSelect={() => {
                      setOpen(false)
                      router.push(`/chats/${chat.id}`)
                    }}
                  >
                    <ChatAvatar seed={bot?.avatar ?? chat.id} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{name}</span>
                        <span
                          className="shrink-0 text-xs text-muted-foreground"
                          suppressHydrationWarning
                        >
                          {formatDistanceToNowStrict(chat.lastMessageAt)}
                        </span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {chat.lastMessagePreview ?? "No messages yet"}
                      </span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

export { ChatSearch }
