"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext, requireCan } from "@/auth/server";
import { BrandProfileInputSchema } from "@/shared/schemas";
import { demoBrand } from "@/db/demo-brand";
import { upsertBrandProfile } from "@/db/queries/brand";
import { AppError } from "@/shared/errors";
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
  try {
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
  } catch (err) {
    const message =
      err instanceof AppError ? err.message : "You cannot save this brand.";
    return { ok: false, errors: {}, message };
  }

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

  const ctx = await requireAuthContext();
  await upsertBrandProfile(ctx.workspaceId, parsed.data);
  revalidatePath("/brand");
  revalidatePath("/");

  return { ok: true, errors: {}, message: "Brand profile saved" };
}

export async function loadDemoBrand(): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await requireAuthContext();
    requireCan(ctx, "load_demo");
    if (process.env.NODE_ENV === "production") {
      throw new AppError("forbidden");
    }
    await upsertBrandProfile(ctx.workspaceId, demoBrand);
    revalidatePath("/brand");
    revalidatePath("/");
    return { ok: true, message: "Demo brand loaded" };
  } catch (err) {
    const message =
      err instanceof AppError ? err.message : "Could not load the demo brand.";
    return { ok: false, message };
  }
}
