import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/env";
import * as schema from "./schema";

// In development, Next's hot reload re-evaluates this module on every edit.
// Cache the postgres client on globalThis so we don't open a fresh pool of
// connections on every reload.
const globalForDb = globalThis as unknown as {
  __postgresClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__postgresClient ??
  postgres(env.DATABASE_URL, { max: 10 });

if (process.env.NODE_ENV === "development") {
  globalForDb.__postgresClient = client;
}

export { client };
export const db = drizzle(client, { schema });
