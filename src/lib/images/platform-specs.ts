import type { PlatformId } from "@/shared/types";

export type ImageSpec = {
  width: number;
  height: number;
  /** Human-readable ratio, used in UI previews and error messages. */
  ratio: string;
};

/**
 * Every platform image size lives here. Change a number in this file and
 * the serving route, the resizer and the tests all follow.
 *
 * Facebook has no entry: its playbook is disabled, so it never reaches the
 * resizer. Add one here when it turns on.
 */
export const PLATFORM_IMAGE_SPECS = {
  x: { width: 1600, height: 900, ratio: "16:9" },
  linkedin: { width: 1200, height: 627, ratio: "1.91:1" },
  instagram: { width: 1080, height: 1350, ratio: "4:5" },
  threads: { width: 1080, height: 1350, ratio: "4:5" },
} as const satisfies Partial<Record<PlatformId, ImageSpec>>;

export type ImagePlatform = keyof typeof PLATFORM_IMAGE_SPECS;

export const IMAGE_PLATFORMS = Object.keys(
  PLATFORM_IMAGE_SPECS,
) as ImagePlatform[];

/** Narrows an arbitrary string to a platform we have a size for. */
export function isImagePlatform(value: string): value is ImagePlatform {
  return Object.hasOwn(PLATFORM_IMAGE_SPECS, value);
}
