import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserBots } from "@/queries/bots"
import { getUserChats } from "@/queries/chats"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Restore the open/collapsed state saved by SidebarProvider
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const [chats, bots] = await Promise.all([getUserChats(), getUserBots()])

  return (
    // The dashboard is exactly one screen tall and never scrolls as a page;
    // each page decides which of its parts scroll
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh min-h-0 overflow-hidden"
    >
      <AppSidebar chats={chats} bots={bots} />
      <SidebarInset className="min-h-0 overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
