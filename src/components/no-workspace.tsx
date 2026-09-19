import { signOut } from "@/auth/actions";
import { BrandMark } from "@/components/brand-mark";

export function NoWorkspace() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="sidebar-brand" style={{ border: "none", margin: 0, padding: "0 0 24px" }}>
          <BrandMark />
          <span className="brand-text-block">
            <span className="brand-title">Leno OS</span>
            <span className="brand-subtitle">Distribution</span>
          </span>
        </div>
        <div className="card">
          <h1 className="card-title">You’re signed in — not on a team yet</h1>
          <p className="card-subtitle" style={{ marginTop: 8 }}>
            Ask an owner to send an invite, then open that link while you’re
            still signed in. One workspace per person.
          </p>
          <form action={signOut} className="mt-6">
            <button type="submit" className="btn btn-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
