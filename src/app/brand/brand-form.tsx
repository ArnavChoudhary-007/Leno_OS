"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildBrandCard, estimateTokens } from "@/shared/brand-card";
import type { BrandProfile, BrandProfileInput } from "@/shared/types";
import { EXAMPLE_POST_COUNT } from "@/shared/schemas";
import { saveBrandProfile, type BrandFormState } from "./actions";
import { ColorField } from "./color-field";
import { Field, inputClass, textareaClass } from "./field";
import { LIST_FIELDS } from "./fields";
import { ListEditor } from "./list-editor";
import { LoadDemoButton } from "./load-demo-button";
import { formatRelativeTime } from "./relative-time";
import { ToneWordsInput } from "./tone-words-input";


function emptyValues(): BrandProfileInput {
  return {
    name: "",
    one_liner: "",
    positioning: "",
    audience: "",
    products: [],
    competitors: [],
    tone_words: [],
    dos: [""],
    donts: [""],
    example_posts: Array.from({ length: EXAMPLE_POST_COUNT }, () => ""),
    primary_color: "#1F6FEB",
    secondary_color: "#F5A623",
  };
}

function toFormValues(profile: BrandProfile | null): BrandProfileInput {
  if (!profile) return emptyValues();
  return {
    name: profile.name,
    one_liner: profile.one_liner,
    positioning: profile.positioning,
    audience: profile.audience,
    products: profile.products,
    competitors: profile.competitors,
    tone_words: profile.tone_words,
    dos: profile.dos,
    donts: profile.donts,
    example_posts: profile.example_posts,
    primary_color: profile.primary_color,
    secondary_color: profile.secondary_color,
  };
}

const initialActionState: BrandFormState = { ok: false, errors: {} };

export function BrandForm({
  profile,
  readOnly = false,
  showDemo = true,
}: {
  profile: BrandProfile | null;
  readOnly?: boolean;
  showDemo?: boolean;
}) {
  const [values, setValues] = useState<BrandProfileInput>(() =>
    toFormValues(profile),
  );
  const [state, formAction, isPending] = useActionState(
    saveBrandProfile,
    initialActionState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Brand profile saved");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  function update<K extends keyof BrandProfileInput>(
    key: K,
    value: BrandProfileInput[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateExamplePost(index: number, value: string) {
    const next = [...values.example_posts];
    next[index] = value;
    update("example_posts", next);
  }

  const card = buildBrandCard(values);
  const tokenEstimate = estimateTokens(card);
  const errors = state.errors;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={formAction} className="flex flex-col gap-6">
        <fieldset disabled={readOnly} className="flex flex-col gap-6">
        {LIST_FIELDS.map((field) => (
          <input
            key={field}
            type="hidden"
            name={field}
            value={JSON.stringify(values[field])}
          />
        ))}

        <Field label="Name" htmlFor="name" error={errors.name}>
          <input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field
          label="One-liner"
          htmlFor="one_liner"
          error={errors.one_liner}
          hint={`${values.one_liner.length}/160`}
        >
          <input
            id="one_liner"
            name="one_liner"
            value={values.one_liner}
            onChange={(e) => update("one_liner", e.target.value)}
            maxLength={160}
            className={inputClass}
          />
        </Field>

        <Field label="Positioning" htmlFor="positioning" error={errors.positioning}>
          <textarea
            id="positioning"
            name="positioning"
            value={values.positioning}
            onChange={(e) => update("positioning", e.target.value)}
            rows={3}
            className={textareaClass}
          />
        </Field>

        <Field label="Audience" htmlFor="audience" error={errors.audience}>
          <textarea
            id="audience"
            name="audience"
            value={values.audience}
            onChange={(e) => update("audience", e.target.value)}
            rows={3}
            className={textareaClass}
          />
        </Field>

        <ListEditor
          label="Products"
          values={values.products}
          onChange={(v) => update("products", v)}
          max={10}
          placeholder="e.g. Loopwave Aero earbuds"
          error={errors.products}
        />

        <ListEditor
          label="Competitors"
          values={values.competitors}
          onChange={(v) => update("competitors", v)}
          max={10}
          placeholder="e.g. SonicPeak"
          error={errors.competitors}
        />

        <ToneWordsInput
          values={values.tone_words}
          onChange={(v) => update("tone_words", v)}
          min={3}
          max={6}
          error={errors.tone_words}
        />

        <ListEditor
          label="Do"
          values={values.dos}
          onChange={(v) => update("dos", v)}
          min={1}
          max={10}
          placeholder="e.g. Lead with a real use case"
          error={errors.dos}
        />

        <ListEditor
          label="Don't"
          values={values.donts}
          onChange={(v) => update("donts", v)}
          min={1}
          max={10}
          placeholder="e.g. Don't use audiophile jargon"
          error={errors.donts}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="Primary color"
            name="primary_color"
            value={values.primary_color}
            onChange={(v) => update("primary_color", v)}
            error={errors.primary_color}
          />
          <ColorField
            label="Secondary color"
            name="secondary_color"
            value={values.secondary_color}
            onChange={(v) => update("secondary_color", v)}
            error={errors.secondary_color}
          />
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-sm font-medium">Example posts</legend>
          {values.example_posts.map((post, index) => (
            <div key={index} className="flex flex-col gap-1">
              <textarea
                value={post}
                onChange={(e) => updateExamplePost(index, e.target.value)}
                rows={2}
                placeholder={`Example post ${index + 1}`}
                className={textareaClass}
              />
              <span
                className={`text-xs ${post.trim().length < 20 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {post.length} characters (min 20)
              </span>
            </div>
          ))}
          {errors.example_posts?.length ? (
            <p className="text-xs text-destructive">{errors.example_posts[0]}</p>
          ) : null}
        </fieldset>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending || readOnly}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          {showDemo ? <LoadDemoButton /> : null}
          {profile ? (
            <span className="text-xs text-muted-foreground">
              Last updated {formatRelativeTime(profile.updated_at)}
            </span>
          ) : null}
        </div>
      </form>

      <aside className="surface flex flex-col gap-2 rounded-2xl border border-border p-4 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">What the agents see</h2>
          <span className="text-xs text-muted-foreground">
            ~{tokenEstimate} tokens
          </span>
        </div>
        <pre className="max-h-[70vh] overflow-auto rounded-xl bg-muted/70 p-4 font-mono text-xs whitespace-pre-wrap text-foreground">
          {card}
        </pre>
      </aside>
    </div>
  );
}
