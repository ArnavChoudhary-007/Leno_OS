import type { BrandProfile } from "@/shared/types";

export interface ResearchNotes {
  trends: string[];
  notes: string[];
}

/**
 * Research/trend agent. Returns empty notes for now.
 * TODO: implement real trend/competitor research once a data source is
 * chosen — this stub keeps the rest of the pipeline runnable without it.
 */
export async function research(brand: BrandProfile): Promise<ResearchNotes> {
  void brand;
  return { trends: [], notes: [] };
}
