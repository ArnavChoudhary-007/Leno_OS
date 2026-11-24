import { signOut } from "@/auth/actions";
import { BrandLockup } from "@/components/brand-mark";

export function NoWorkspace() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <BrandLockup />
        <h1 className="l-auth-title">Not on a team yet</h1>
        <p className="l-auth-sub">
          You’re signed in, but no workspace has added you. Ask an owner to send an
          invite, then open that link while you’re still signed in.
        </p>
        <form action={signOut} style={{ marginTop: 8 }}>
          <button type="submit" className="l-btn l-btn-outline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
