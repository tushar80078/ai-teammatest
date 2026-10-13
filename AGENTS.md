<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git
- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.

## Database
- Apply schema changes only with `npm run db:push` (`drizzle-kit push`), after editing `db/schema.ts`.
- Never use migrations: do not run `drizzle-kit generate` or `drizzle-kit migrate`, and do not create migration files or folders.
- This is a development project. There is no backwards compatibility and the data is worthless.
- Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort keeping old data working. Every schema change means a clean slate.

## Forms
Reference implementation: `components/bot-dialog.tsx` + `actions/bot.ts` + `insertBotSchema` in `db/schema.ts`.

- **One schema, derived from the table.** Build the validation schema with `createInsertSchema` from `drizzle-zod`, next to the table in `db/schema.ts`. Refine fields there (trim, min/max, user-facing messages) and `.omit()` everything the server sets (`id`, `userId`, timestamps, third-party IDs). Export its type with `z.infer`. Never hand-write a parallel zod schema or form type.
- **Same schema on both sides.** The client form uses it via `zodResolver`; the server action re-validates with `safeParse` before touching the database. Client validation is UX only.
- **Server actions live in `actions/<entity>.ts`** with `"use server"`. Start every action with `await auth.protect()` from `@clerk/nextjs/server` and take `userId` from it, never from input. Return `{ <entity> } | { error: string }` (e.g. `{ bot }`) instead of throwing for expected failures, and call `revalidatePath` after a mutation.
- **Client form = react-hook-form + shadcn `Field` composition.** Each input is a `Controller` rendering `Field data-invalid` → `FieldLabel htmlFor` → control with matching `id` and `aria-invalid` → `FieldError` when invalid. Wrap fields in `FieldGroup`. Use `Input`, `Textarea`, etc. from `components/ui`, never raw elements or `space-y-*` layouts.
- **Nullable text columns:** pass `value={field.value ?? ""}` to the control and store empty strings as `null` in the action.
- **Read live values with `useWatch`**, not `form.watch()` (the React Compiler can't memoize `watch`).
- **Server errors go to `form.setError("root", …)`** and render with a `FieldError`; success feedback uses `toast.add()` from `@/components/ui/toast`.
- **Forms in dialogs:** give the `<form>` an `id` and put the submit `Button` in `DialogFooter` with `form="<id>"`. Cancel is `DialogClose render={<Button variant="outline" />}`. Control `open` state, `form.reset()` with fresh defaults when the dialog opens, and close it on success. While submitting, disable the submit button and show a `Spinner data-icon="inline-start"`.
- **Non-submit buttons inside a form** (presets, shuffle) need `type="button"`; set values with `form.setValue`.
- **Defaults that must be random** (nanoid seeds, etc.) are generated in a function called on reset, not as module constants.
- **Installing form deps:** `@hookform/resolvers` has an optional peer on zod 3 that conflicts with zod 4; use `npm i --legacy-peer-deps`.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.