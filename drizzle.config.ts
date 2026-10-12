import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

loadEnvConfig(process.cwd())

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: "postgresql",
  // Schema pushes need the direct (non-pooled) connection
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
})
