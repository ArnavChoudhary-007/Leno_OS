"use client";

import { Field, inputClass } from "./field";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ColorField({
  label,
  name,
  value,
  onChange,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string[];
}) {
  const isValidHex = HEX_COLOR_REGEX.test(value);

  return (
    <Field label={label} htmlFor={name} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isValidHex ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-border bg-transparent p-1"
        />
        <input
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1A2B3C"
          aria-invalid={!isValidHex}
          className={inputClass}
        />
      </div>
    </Field>
  );
}
