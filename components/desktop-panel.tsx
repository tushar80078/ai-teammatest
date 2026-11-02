"use client"

import { cn } from "cn"
import { MonitorIcon, MonitorXIcon } from "lucide-react"
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { getDesktopUrl } from "@/actions/desktop"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Toggle } from "@/components/ui/toggle"

type Desktop = { status: "loading" } | { url: string } | { error: string }

const DesktopPanelContext = createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  fullscreen: boolean
  setFullscreen: (fullscreen: boolean) => void
  desktop: Desktop
  setPanelTarget: (element: HTMLElement | null) => void
  setDialogTarget: (element: HTMLElement | null) => void
} | null>(null)

function useDesktopPanel() {
  const context = use(DesktopPanelContext)
  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider")
  }
  return context
}

// Shares the desktop panel's state between the header and the page, and owns
// the one VNC viewer that both the panel and the fullscreen dialog show
function DesktopPanelProvider({
  chatId,
  children,
}: {
  chatId: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [desktop, setDesktop] = useState<Desktop>({ status: "loading" })
  const [panelTarget, setPanelTarget] = useState<HTMLElement | null>(null)
  const [dialogTarget, setDialogTarget] = useState<HTMLElement | null>(null)

  // Fetch the VNC URL the first time the panel opens, then keep it
  const requested = useRef(false)
  useEffect(() => {
    if (!open || requested.current) return
    requested.current = true
    getDesktopUrl(chatId).then(setDesktop)
  }, [open, chatId])

  return (
    <DesktopPanelContext
      value={{
        open,
        setOpen,
        fullscreen,
        setFullscreen,
        desktop,
        setPanelTarget,
        setDialogTarget,
      }}
    >
      {children}
      {"url" in desktop && (
        <DesktopViewer
          url={desktop.url}
          target={dialogTarget ?? panelTarget}
          interactive={dialogTarget !== null}
        />
      )}
    </DesktopPanelContext>
  )
}

// Moving an iframe in the DOM reloads it, so the viewer is rendered once and
// laid over whichever slot is showing it, panel or dialog, every frame. It
// stays loaded but hidden while neither is open
function DesktopViewer({
  url,
  target,
  interactive,
}: {
  url: string
  target: HTMLElement | null
  interactive: boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    if (!target) {
      frame.style.visibility = "hidden"
      return
    }

    let animationFrame = 0
    function follow() {
      const { top, left, width, height } = target!.getBoundingClientRect()
      Object.assign(frame!.style, {
        visibility: "visible",
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
      })
      animationFrame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(animationFrame)
  }, [target])

  return (
    <iframe
      ref={frameRef}
      src={url}
      title="Bot desktop"
      allow="clipboard-read; clipboard-write"
      className={cn(
        "invisible fixed rounded-lg border-0",
        // Above the dialog when fullscreen; in the panel, clicks pass through
        // to the preview button underneath
        interactive ? "z-[51]" : "pointer-events-none"
      )}
    />
  )
}

// The header button that opens and closes the desktop panel
function DesktopPanelToggle() {
  const { open, setOpen } = useDesktopPanel()
  return (
    <Toggle
      pressed={open}
      onPressedChange={setOpen}
      aria-label="Desktop"
      className="ml-auto"
    >
      <MonitorIcon />
    </Toggle>
  )
}

// Mounts its children, the panel and its handle, only while the panel is open
function DesktopPanelSlot({ children }: { children: ReactNode }) {
  const { open } = useDesktopPanel()
  return open ? children : null
}

// The panel's content: a preview of the desktop that opens it fullscreen
function DesktopPreview() {
  const {
    desktop,
    fullscreen,
    setFullscreen,
    setPanelTarget,
    setDialogTarget,
  } = useDesktopPanel()

  if ("error" in desktop) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MonitorXIcon />
          </EmptyMedia>
          <EmptyTitle>Desktop unavailable</EmptyTitle>
          <EmptyDescription>{desktop.error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (!("url" in desktop)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <Dialog
      open={fullscreen}
      // Non-modal so the viewer, which lives outside the dialog, can take
      // focus and clicks. Only the close button closes it: Escape, outside
      // clicks and focus changes are meant for the desktop
      modal={false}
      disablePointerDismissal
      onOpenChange={(next, { reason }) => {
        if (next || reason === "close-press") setFullscreen(next)
      }}
    >
      {/* Pinned to the top of the panel at the desktop's 16:9 shape */}
      <div className="p-2">
        <div ref={setPanelTarget} className="relative aspect-video w-full">
          <DialogTrigger
            aria-label="Open the desktop fullscreen"
            className="absolute inset-0 cursor-zoom-in"
          />
        </div>
      </div>
      <DialogContent className="flex h-[calc(100svh-2rem)] flex-col sm:max-w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Desktop</DialogTitle>
        </DialogHeader>
        <div ref={setDialogTarget} className="min-h-0 flex-1" />
      </DialogContent>
    </Dialog>
  )
}

export {
  DesktopPanelProvider,
  DesktopPanelSlot,
  DesktopPanelToggle,
  DesktopPreview,
}
