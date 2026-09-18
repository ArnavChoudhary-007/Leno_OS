"use client";

import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./field";

export function ListEditor({
  label,
  values,
  onChange,
  min = 0,
  max,
  placeholder,
  error,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  error?: string[];
}) {
  function updateRow(index: number, value: string) {
    const next = [...values];
    next[index] = value;
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...values, ""]);
  }

  const atMax = typeof max === "number" && values.length >= max;

  return (
    <Field
      label={label}
      error={error}
      hint={typeof max === "number" ? `${values.length}/${max}` : undefined}
    >
      <div className="flex flex-col gap-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={value}
              placeholder={placeholder}
              onChange={(e) => updateRow(index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className={inputClass}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label} row ${index + 1}`}
              onClick={() => removeRow(index)}
              disabled={values.length <= min}
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={atMax}
          className="self-start"
        >
          <Plus /> Add
        </Button>
      </div>
    </Field>
  );
}
