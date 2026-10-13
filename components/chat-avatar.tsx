import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import gaze from "@dicebear/styles/gaze.json"
import { cn } from "cn"

const gazeStyle = new Style(gaze)

function ChatAvatar({
  seed,
  animated = false,
  className,
}: {
  seed: string
  animated?: boolean
  className?: string
}) {
  const src = new Avatar(gazeStyle, {
    seed,
    animationProbability: animated ? 100 : 0,
    ...(animated && { animationVariant: ["medium"] }),
  }).toDataUri()

  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

export { ChatAvatar }
