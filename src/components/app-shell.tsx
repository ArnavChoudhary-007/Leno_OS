import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth/actions";
import { BrandMark } from "@/components/brand-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/shared/types";

const WIDTH = {
  default: "max-w-3xl",
  wide: "max-w-5xl",
  narrow: "max-w-xl",
} as const;

export function AppShell({
  children,
  email,
  role,
  canMutate,
  current,
  width = "default",
}: {
  children: ReactNode;
  email: string | null;
  role: WorkspaceRole;
  canMutate: boolean;
  current: "home" | "brand" | "campaign";
  width?: keyof typeof WIDTH;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-foreground no-underline"
            >
              <BrandMark size="sm" />
              <span className="text-sm font-semibold tracking-tight">
                Distribution OS
              </span>
            </Link>
            <nav aria-label="Primary" className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
              <NavLink href="/" active={current === "home"}>
                Home
              </NavLink>
              <NavLink href="/brand" active={current === "brand"}>
                Brand
              </NavLink>
              {canMutate ? (
                <NavLink
                  href="/campaigns/new"
                  active={current === "campaign"}
                >
                  <span className="sm:hidden">New</span>
                  <span className="hidden sm:inline">New campaign</span>
                </NavLink>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden max-w-40 truncate text-xs text-muted-foreground md:block">
              {email ?? role}
            </p>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className={cn("mx-auto w-full flex-1 px-6 py-10", WIDTH[width])}>
        {children}
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
