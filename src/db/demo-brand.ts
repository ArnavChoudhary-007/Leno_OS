import type { BrandProfileInput } from "@/shared/types";

/**
 * A fictional demo brand — Loopwave Audio is not a real company. Used by
 * `npm run db:seed` and by the "Load demo brand" button on /brand.
 */
export const demoBrand: BrandProfileInput = {
  name: "Loopwave Audio",
  one_liner: "Wireless earbuds tuned for people who think better in motion.",
  positioning:
    "Premium sound and all-day comfort for runners, commuters, and creators — without the audiophile price tag or the subscription upsells.",
  audience:
    "Urban professionals and students, 20-35, who run, commute, or work from cafes and want great sound without fuss.",
  products: [
    "Loopwave Aero earbuds",
    "Loopwave Aero Case Pro",
    "Loopwave Beam desktop speaker",
  ],
  competitors: ["SonicPeak", "AuraBuds", "EchoFrame"],
  tone_words: ["direct", "warm", "a little playful", "confident, not braggy"],
  dos: [
    "Lead with a real use case, not a spec sheet",
    "Use short, punchy sentences",
    "Credit the person, not just the product",
  ],
  donts: [
    "Don't use audiophile jargon",
    "Don't compare directly to competitors by name",
    "Don't over-promise battery life",
  ],
  example_posts: [
    "Left the house without your keys but not your earbuds? Same. Loopwave Aero, all day.",
    "Six hours of meetings. Zero charging anxiety. That's the Aero Case Pro doing its job.",
    "Your commute playlist deserves better than tinny bus-stop audio. Loopwave has you.",
    "We built Aero for the person who runs at 6am and DJs a dinner party at 9pm. Same earbuds, same you.",
    "Real talk: most 'studio quality' claims are marketing. We just made earbuds that sound good and stay put.",
  ],
  primary_color: "#1F6FEB",
  secondary_color: "#F5A623",
};
