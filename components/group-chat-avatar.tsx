import { cn } from "cn"

import { ChatAvatar } from "@/components/chat-avatar"

// Bots shown before the rest collapse into a "+N" count
const MAX_VISIBLE = 3

// Where each item sits inside the square, by how many items are shown: two
// overlap corner to corner, three form a triangle, four fill a 2x2 grid
const layouts = {
  1: ["inset-0 size-full"],
  2: ["top-0 left-0 size-[62%]", "right-0 bottom-0 size-[62%]"],
  3: [
    "top-0 left-[23%] size-[54%]",
    "bottom-0 left-0 size-[54%]",
    "right-0 bottom-0 size-[54%]",
  ],
  4: [
    "top-0 left-0 size-1/2",
    "top-0 right-0 size-1/2",
    "bottom-0 left-0 size-1/2",
    "right-0 bottom-0 size-1/2",
  ],
} as const

// A group chat's face: its bots' faces packed into the same square as a
// single ChatAvatar, so both take up identical space wherever they render.
// Size it the same way, with a size-* class
function GroupChatAvatar({
  seeds,
  className,
}: {
  seeds: string[]
  className?: string
}) {
  const visible = seeds.slice(0, MAX_VISIBLE)
  const rest = seeds.length - visible.length
  const count = Math.max(visible.length + (rest > 0 ? 1 : 0), 1)
  const slots: readonly string[] = layouts[count as keyof typeof layouts]

  return (
    // A size container so the count's text scales with the avatar
    <div className={cn("@container relative size-8 shrink-0", className)}>
      {visible.map((seed, i) => (
        <ChatAvatar
          key={seed}
          seed={seed}
          className={cn("absolute ring-1 ring-background", slots[i])}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-muted text-[22cqw] leading-none font-medium text-muted-foreground",
            slots[MAX_VISIBLE]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
