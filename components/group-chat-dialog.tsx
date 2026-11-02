"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, type ReactElement, type ReactNode } from "react"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/actions/chat"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  insertGroupChatSchema,
  type Bot,
  type InsertGroupChat,
} from "@/db/schema"
import type { UserChat } from "@/queries/chats"

// A blank group to create, or the given group's current name and bots to edit
function groupChatDefaults(chat?: UserChat): InsertGroupChat {
  if (chat) {
    return {
      name: chat.name ?? "",
      botIds: chat.members.map((member) => member.bot.id),
    }
  }
  return { name: "", botIds: [] }
}

// Asks for confirmation, then deletes the group chat; its bots stay. On
// success the action redirects home, so only failures come back here
function DeleteGroupChatButton({ chat }: { chat: UserChat }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function onDelete() {
    setIsDeleting(true)
    const result = await deleteGroupChat(chat.id)
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
          <AlertDialogTitle>
            Delete {chat.name ?? "this group"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the group chat and its messages. Its bots and their own
            chats stay. You can&apos;t undo this.
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

// Creates a group chat and opens it, or edits `chat` when one is passed:
// its name and bots, or deleting it. `bots` are all the user's bots to pick
// from. Uncontrolled, it renders `trigger` (an element) with `children` as
// its content; pass `open` and `onOpenChange` to open it from elsewhere, e.g.
// the sidebar's "Create group chat" menu item
function GroupChatDialog({
  chat,
  bots,
  open: openProp,
  onOpenChange,
  trigger,
  children,
}: {
  chat?: UserChat
  bots: Bot[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactElement
  children?: ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const router = useRouter()
  const form = useForm<InsertGroupChat>({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: groupChatDefaults(chat),
  })

  async function onSubmit(values: InsertGroupChat) {
    const result = chat
      ? await updateGroupChat(chat.id, values)
      : await createGroupChat(values)
    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }
    toast.add({
      title: chat
        ? `${result.chat.name} is updated`
        : `${result.chat.name} is ready`,
      type: "success",
    })
    setOpen(false)
    if (!chat) router.push(`/chats/${result.chat.id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Opening from the trigger: load the group's latest saved values,
        // which a save's refresh may have changed since the last close
        if (nextOpen) form.reset(groupChatDefaults(chat))
        setOpen(nextOpen)
      }}
      // Start fresh once the close animation ends: blank to create, or the
      // group's saved values to edit
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) form.reset(groupChatDefaults(chat))
      }}
    >
      {!isControlled && trigger && (
        <DialogTrigger render={trigger}>{children}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {chat ? "Edit group chat" : "New group chat"}
          </DialogTitle>
          <DialogDescription>
            {chat
              ? "Rename the group or change which bots are in it."
              : "Name the group and pick which bots are in it."}
          </DialogDescription>
        </DialogHeader>
        <form id="group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="group-chat-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="group-chat-name"
                    placeholder="Weekend plans"
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
              name="botIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Bots</FieldLegend>
                  {bots.length < 2 && (
                    <FieldDescription>
                      A group needs at least two bots. Create another bot first.
                    </FieldDescription>
                  )}
                  <FieldGroup data-slot="checkbox-group">
                    {bots.map((bot) => {
                      const id = `group-chat-bot-${bot.id}`
                      return (
                        <Field key={bot.id} orientation="horizontal">
                          <Checkbox
                            id={id}
                            checked={field.value.includes(bot.id)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked
                                  ? [...field.value, bot.id]
                                  : field.value.filter(
                                      (botId) => botId !== bot.id
                                    )
                              )
                            }
                            aria-invalid={fieldState.invalid}
                          />
                          <FieldLabel htmlFor={id} className="font-normal">
                            <ChatAvatar seed={bot.avatar} className="size-5" />
                            {bot.name}
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </FieldSet>
              )}
            />
            {form.formState.errors.root && (
              <FieldError errors={[form.formState.errors.root]} />
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          {chat && <DeleteGroupChatButton chat={chat} />}
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="group-chat-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            {chat ? "Save changes" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
