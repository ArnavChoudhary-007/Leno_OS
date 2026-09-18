import { getBrandProfile } from "@/db/queries/brand";
import { BrandForm } from "./brand-form";

// Reads live data and has no cacheable static shell; also lets this page
// (and the Docker build, which has no database to prerender against) skip
// static generation entirely.
export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const profile = await getBrandProfile();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-xl font-semibold">Brand profile</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        This is the company context every agent — brand, research, strategy,
        platform, and critic — reads before writing or reviewing anything.
      </p>

      {!profile ? (
        <p className="mt-4 max-w-2xl rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          No brand profile yet. Fill in the form below, or load the demo
          brand to see what a filled-in profile looks like.
        </p>
      ) : null}

      <div className="mt-8">
        <BrandForm key={profile?.updated_at ?? "empty"} profile={profile} />
      </div>
    </main>
  );
}
