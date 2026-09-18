/**
 * Inserts one demo brand profile so the app has data to render against
 * before any real campaign exists. Loopwave Audio is a fictional company
 * invented for this project — it is not a real brand.
 *
 * Run with: npm run db:seed
 */
import { client } from "./client";
import { demoBrand } from "./demo-brand";
import { upsertBrandProfile } from "./queries/brand";

async function main() {
  await upsertBrandProfile(demoBrand);
  console.log("Seeded demo brand: Loopwave Audio");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
