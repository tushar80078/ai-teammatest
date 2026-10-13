"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
import { insertBotSchema, type InsertBot } from "@/db/schema"

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

function emptyBot(): InsertBot {
  return { name: "", avatar: nanoid(), job: "", instructions: "" }
}

function BotDialog() {
  const [open, setOpen] = useState(false)
  const form = useForm<InsertBot>({
    resolver: zodResolver(insertBotSchema),
    defaultValues: emptyBot(),
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) form.reset(emptyBot())
    setOpen(nextOpen)
  }

  async function onSubmit(values: InsertBot) {
    const result = await createBot(values)
    if ("error" in result) {
      form.setError("root", { message: result.error })
      return
    }
    toast.add({ title: `${result.bot.name} is ready`, type: "success" })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="secondary" size="lg" />}>
        <PlusIcon data-icon="inline-start" />
        Create a new bot
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
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
            Create bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
