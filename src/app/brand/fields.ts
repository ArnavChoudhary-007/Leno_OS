/**
 * The brand-profile fields the form submits as JSON strings in hidden
 * inputs. Shared by the form and the server action so the two can't drift
 * apart and silently stop saving a field.
 */
export const LIST_FIELDS = [
  "products",
  "competitors",
  "tone_words",
  "dos",
  "donts",
  "example_posts",
] as const;

export type ListField = (typeof LIST_FIELDS)[number];
