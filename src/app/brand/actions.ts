"use server";

import { revalidatePath } from "next/cache";
import { BrandProfileInputSchema } from "@/shared/schemas";
import { demoBrand } from "@/db/demo-brand";
import { upsertBrandProfile } from "@/db/queries/brand";
import { LIST_FIELDS } from "./fields";

export type BrandFormState = {
  ok: boolean;
  errors: Record<string, string[]>;
  message?: string;
};

function parseListField(formData: FormData, field: string): unknown {
  const raw = formData.get(field);
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveBrandProfile(
  _prevState: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const raw: Record<string, unknown> = {
    name: formData.get("name"),
    one_liner: formData.get("one_liner"),
    positioning: formData.get("positioning"),
    audience: formData.get("audience"),
    primary_color: formData.get("primary_color"),
    secondary_color: formData.get("secondary_color"),
  };

  for (const field of LIST_FIELDS) {
    raw[field] = parseListField(formData, field);
  }

  const parsed = BrandProfileInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      message: "Fix the highlighted fields and try again.",
    };
  }

  await upsertBrandProfile(parsed.data);
  revalidatePath("/brand");
  revalidatePath("/");

  return { ok: true, errors: {}, message: "Brand profile saved" };
}

export async function loadDemoBrand(): Promise<void> {
  await upsertBrandProfile(demoBrand);
  revalidatePath("/brand");
  revalidatePath("/");
}
