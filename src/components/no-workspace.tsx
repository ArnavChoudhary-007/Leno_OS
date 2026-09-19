import { signOut } from "@/auth/actions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export function NoWorkspace() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight">
          Distribution OS
        </span>
      </div>
      <div className="surface rounded-2xl border border-border p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          You’re signed in — not on a team yet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ask an owner to send an invite, then open that link while you’re
          still signed in. One workspace per person.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
