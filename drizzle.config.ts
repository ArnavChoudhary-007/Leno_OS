import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only needed by db:push / db:migrate / db:studio, not by db:generate.
    url: process.env.DATABASE_URL ?? "",
  },
});
