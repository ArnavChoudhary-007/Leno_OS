"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Field, inputClass } from "./field";

export function ToneWordsInput({
  values,
  onChange,
  min,
  max,
  error,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  min: number;
  max: number;
  error?: string[];
}) {
  const [draft, setDraft] = useState("");

  function addWord() {
    const word = draft.trim();
    if (!word || values.length >= max) {
      setDraft("");
      return;
    }
    onChange([...values, word]);
    setDraft("");
  }

  function removeWord(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <Field
      label="Tone words"
      error={error}
      hint={`${values.length}/${max} (min ${min})`}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-input/30 p-2">
        {values.map((word, index) => (
          <button
            key={`${word}-${index}`}
            type="button"
            onClick={() => removeWord(index)}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:opacity-80"
            aria-label={`Remove tone word ${word}`}
          >
            {word}
            <X className="size-3" />
          </button>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addWord();
            }
          }}
          onBlur={addWord}
          placeholder={values.length < max ? "Type a tone word, press Enter" : ""}
          disabled={values.length >= max}
          className={`${inputClass} h-7 min-w-32 flex-1 border-none bg-transparent px-1 focus-visible:ring-0`}
        />
      </div>
    </Field>
  );
}
