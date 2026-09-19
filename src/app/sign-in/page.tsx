import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/server";
import { AuthFrame } from "@/components/auth-frame";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const user = await getSessionUser();
  if (user) redirect("/");

  const params = await searchParams;
  const nextRaw = typeof params.next === "string" ? params.next : "/";
  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  return (
    <AuthFrame
      title="Welcome back"
      description="This workspace is invite-only. Use the email an owner sent you."
    >
      <SignInForm nextPath={nextPath} />
    </AuthFrame>
  );
}
