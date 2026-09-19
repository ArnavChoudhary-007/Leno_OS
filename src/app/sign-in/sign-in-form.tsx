"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/app/brand/field";

const initial: SignInState = { ok: false };

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
          disabled={pending}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className={inputClass}
          disabled={pending}
        />
      </Field>
      {state.message ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} size="lg">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
