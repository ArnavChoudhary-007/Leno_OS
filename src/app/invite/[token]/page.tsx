import Link from "next/link";
import { getSessionUser } from "@/auth/server";
import { AuthFrame } from "@/components/auth-frame";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AcceptInviteForm } from "./accept-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const user = await getSessionUser();

  return (
    <AuthFrame
      title="Join this workspace"
      description={
        user
          ? "Accept the invite to start reviewing and shipping campaigns with this team."
          : "Sign in with the invited email, then return to this link."
      }
    >
      {user ? (
        <AcceptInviteForm token={token} />
      ) : (
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Sign in to continue
        </Link>
      )}
    </AuthFrame>
  );
}
