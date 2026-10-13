import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import type { z } from "zod"

export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID of the owner
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    // Seed for the bot's generated face
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()),
    job: text("job").notNull(),
    instructions: text("instructions"),
    // Sandbox provider ID, created lazily
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert

// Fields a user fills in; id, owner, sandbox, and timestamp are set server-side
export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) => schema.trim().min(1, "Give your bot a name").max(50),
  avatar: (schema) => schema.min(1),
  job: (schema) => schema.trim().min(1, "Say what the bot is for").max(100),
  instructions: (schema) => schema.trim().max(2000),
}).omit({ id: true, userId: true, sandboxId: true, createdAt: true })

export type InsertBot = z.infer<typeof insertBotSchema>
