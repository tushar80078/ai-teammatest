"use client"

import { useState, type ReactElement, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { insertBotSchema, type Bot, type InsertBot } from "@/db/schema"

const presets = [
  {
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    job: "Code reviewer",
    instructions:
      "Point out bugs first, then risky patterns. Suggest concrete fixes and skip style nits.",
  },
  {
    job: "Writing editor",
    instructions:
      "Tighten wording, keep my voice, and explain any change that alters meaning.",
  },
  {
    job: "Tutor",
    instructions:
      "Teach step by step, check my understanding with questions, and don't just give answers.",
  },
]

// A blank bot to create, or the given bot's current values to edit
function botDefaults(bot?: Bot): InsertBot {
  if (bot) {
    return {
      name: bot.name,
      avatar: bot.avatar,
      job: bot.job,
      instructions: bot.instructions ?? "",
    }
  }
  return { name: "", avatar: nanoid(), job: "", instructions: "" }
}

// Asks for confirmation, then deletes the bot and its direct chat. On success
// the action redirects home, so only failures come back here
function DeleteBotButton({ bot }: { bot: Bot }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function onDelete() {
    setIsDeleting(true)
    const result = await deleteBot(bot.id)
    setIsDeleting(false)
    toast.add({ title: result.error, type: "error" })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive" className="sm:mr-auto" />
        }
      >
        <Trash2Icon data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the bot and its chat. You can&apos;t undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Creates a bot, or edits `bot` when one is passed.
// Uncontrolled, it renders its own trigger: `trigger` (an element) with
// `children` as its content, or a "Create a new bot" button by default. Pass
// `open` and `onOpenChange` to open it from elsewhere (e.g. a menu item)
// without a trigger.
function BotDialog({
  bot,
  open: openProp,
  onOpenChange,
  trigger,
  children,
}: {
  bot?: Bot
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactElement
  children?: ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const form = useForm<InsertBot>({
    resolver: zodResolver(insertBotSchema),
    defaultValues: botDefaults(bot),
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })

  async function onSubmit(values: InsertBot) {
    const result = bot
      ? await updateBot(bot.id, values)
      : await createBot(values)
    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }
    toast.add({
      title: bot
        ? `${result.bot.name} is updated`
        : `${result.bot.name} is ready`,
      type: "success",
    })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      // Start fresh once the close animation ends: a new face and empty
      // fields to create, or the bot's saved values to edit
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) form.reset(botDefaults(bot))
      }}
    >
      {!isControlled &&
        (trigger ? (
          <DialogTrigger render={trigger}>{children}</DialogTrigger>
        ) : (
          <DialogTrigger render={<Button variant="secondary" size="lg" />}>
            <PlusIcon data-icon="inline-start" />
            Create a new bot
          </DialogTrigger>
        ))}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bot ? "Edit bot" : "New bot"}</DialogTitle>
          <DialogDescription>
            {bot
              ? "Change its face, name, or job."
              : "Give it a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.job}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                form.setValue("job", preset.job, { shouldValidate: true })
                form.setValue("instructions", preset.instructions)
              }}
            >
              {preset.job}
            </Button>
          ))}
        </div>
        <form id="bot-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Item className="px-0">
              <ItemMedia>
                <ChatAvatar seed={avatar} className="size-12" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Face</ItemTitle>
                <ItemDescription>
                  Shuffle until you find one you like.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => form.setValue("avatar", nanoid())}
                >
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
              </ItemActions>
            </Item>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="bot-name"
                    placeholder="Ada"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="job"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                  <Input
                    {...field}
                    id="bot-job"
                    placeholder="Research assistant"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="instructions"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-instructions">
                    How it should work
                  </FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    id="bot-instructions"
                    placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                    className="min-h-24"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            {form.formState.errors.root && (
              <FieldError errors={[form.formState.errors.root]} />
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          {bot && <DeleteBotButton bot={bot} />}
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="bot-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            {bot ? "Save changes" : "Create bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
