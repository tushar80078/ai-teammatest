"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { ChatSearch } from "@/components/chat-search"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  sidebarMenuButtonVariants,
} from "@/components/ui/sidebar"
import type { UserChat } from "@/queries/chats"

function AppSidebar({ chats }: { chats: UserChat[] }) {
  const [botDialogOpen, setBotDialogOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" />}
            >
              <PlusIcon />
              <span className="sr-only">New</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
                  <PlusIcon />
                  Create new bot
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <UsersIcon />
                  Create group chat
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ChatSearch chats={chats} />
        <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => {
                // Group chats aren't handled yet; use the first bot to join
                const bot = chat.members[0]?.bot
                const href = `/chats/${chat.id}`
                const name = chat.name ?? bot?.name ?? "Untitled chat"

                return (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      size="lg"
                      render={<Link href={href} />}
                      isActive={pathname === href}
                      tooltip={name}
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      {/* Shrinks to icon size when collapsed so every button
                          in the icon rail has the same visual weight */}
                      <ChatAvatar
                        seed={bot?.avatar ?? chat.id}
                        className="group-data-[collapsible=icon]:size-5"
                      />
                      <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
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
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Style Clerk's trigger as a SidebarMenuButton; Clerk's theme
                styles live in a lower CSS layer, so these utilities win */}
            <UserButton
              showName
              appearance={{
                elements: {
                  // Clerk's own styles size the root and trigger to their
                  // content; force them to fill the menu item
                  rootBox: "flex! w-full!",
                  // Same classes as SidebarMenuButton; interaction states are
                  // forced so Clerk's trigger styles can't cancel them
                  userButtonTrigger: sidebarMenuButtonVariants({
                    size: "lg",
                    className:
                      "w-full! justify-start! shadow-none! group-data-[collapsible=icon]:justify-center! hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground! focus-visible:ring-2! active:bg-sidebar-accent! active:text-sidebar-accent-foreground! aria-expanded:bg-sidebar-accent! aria-expanded:text-sidebar-accent-foreground!",
                  }),
                  userButtonBox:
                    "w-full min-w-0 flex-row-reverse justify-end gap-2 text-inherit",
                  userButtonAvatarBox:
                    "size-6! group-data-[collapsible=icon]:size-5!",
                  userButtonOuterIdentifier:
                    "truncate p-0 text-sm font-medium text-inherit group-data-[collapsible=icon]:hidden",
                },
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export { AppSidebar }
