"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
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

function groupChatDefaults(): InsertGroupChat {
  return { name: "", botIds: [] }
}

// Names a new group chat and picks its bots, then opens it. Controlled: open
// it from elsewhere, e.g. the sidebar's "Create group chat" menu item
function GroupChatDialog({
  bots,
  open,
  onOpenChange,
}: {
  bots: Bot[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const form = useForm<InsertGroupChat>({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: groupChatDefaults(),
  })

  async function onSubmit(values: InsertGroupChat) {
    const result = await createGroupChat(values)
    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }
    toast.add({ title: `${result.chat.name} is ready`, type: "success" })
    onOpenChange(false)
    router.push(`/chats/${result.chat.id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      // Start blank once the close animation ends
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) form.reset(groupChatDefaults())
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group and pick which bots are in it.
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
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
