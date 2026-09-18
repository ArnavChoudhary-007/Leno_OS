import type { BrandProfile } from "@/shared/types";

/**
 * Builds the compact brand context packet passed into every downstream
 * agent's prompt (writer, critic, strategy, ...).
 *
 * TODO: implement — condense a BrandProfile (and, later, research notes)
 * into a short packet instead of dumping the whole record into prompts.
 */
export async function buildBrandPacket(brand: BrandProfile): Promise<string> {
  void brand;
  throw new Error("buildBrandPacket() is not implemented yet");
}
