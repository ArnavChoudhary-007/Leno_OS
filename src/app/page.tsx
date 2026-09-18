import Link from "next/link";
import { getBrandProfile } from "@/db/queries/brand";

// Reads live data; also lets the Docker build (no database available while
// building the image) skip prerendering this page.
export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await getBrandProfile();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Digital Distribution OS
        </h1>
        <p className="mt-2 text-muted-foreground">
          One campaign brief in, on-brand platform-native posts out —
          reviewed by a critic agent, approved by a human, then published.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {profile
          ? `Brand profile: ${profile.name}`
          : "No brand profile set up yet."}
      </p>
      <nav className="flex gap-4">
        <Link href="/brand" className="underline underline-offset-4">
          {profile ? "Edit brand" : "Set up your brand"}
        </Link>
        <Link href="/campaigns/new" className="underline underline-offset-4">
          New campaign
        </Link>
      </nav>
    </main>
  );
}
