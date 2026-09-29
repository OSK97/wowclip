import { loadFont as remotionLoadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const loaded = new Set<string>();

const AVAILABLE_FONTS: Record<string, string[]> = {
  Inter: ["300", "400", "500", "600", "700", "800", "900"],
  PlayfairDisplay: ["400", "600", "700"],
  DancingScript: ["700"],
  Montserrat: ["400", "700"],
  Outfit: ["400", "700"],
  Lora: ["400", "700"],
  EBGaramond: ["400", "700"],
  Poppins: ["300", "400", "500", "600", "700", "800"],
};

function registerFont(family: string, style: "normal" | "italic" = "normal", weights: string[] = ["400"]) {
  const allowed = AVAILABLE_FONTS[family] || ["400"];
  for (const weight of weights) {
    if (!allowed.includes(weight)) continue;
    const key = `${family}-${weight}-${style}`;
    if (!loaded.has(key)) {
      loaded.add(key);
      // Temporarily disabled to prevent render timeouts on missing font files
      /*
      remotionLoadFont({
        family,
        url: staticFile(`fonts/${family}-${weight}-${style}.woff2`),
        weight,
        style,
      }).catch((err) => {
        console.error(`Failed to load local font ${key}:`, err);
      });
      */
    }
  }
}

export function createFontLoader(family: string, defaultWeights: string[]) {
  return function loadFont(
    style: "normal" | "italic" = "normal",
    options?: { weights?: (string | number)[]; subsets?: string[] }
  ) {
    const weightsToLoad = options?.weights 
      ? options.weights.map(w => String(w)) 
      : defaultWeights;
    
    registerFont(family, style, weightsToLoad);
    return { fontFamily: family };
  };
}

export const loadInter = createFontLoader("Inter", ["300", "400", "500", "600", "700", "800", "900"]);
export const loadPlayfair = createFontLoader("PlayfairDisplay", ["400", "600", "700"]);
export const loadDancingScript = createFontLoader("DancingScript", ["700"]);
export const loadMontserrat = createFontLoader("Montserrat", ["400", "700"]);
export const loadOutfit = createFontLoader("Outfit", ["400", "700"]);
export const loadLora = createFontLoader("Lora", ["400", "700"]);
export const loadEBGaramond = createFontLoader("EBGaramond", ["400", "700"]);
export const loadPoppins = createFontLoader("Poppins", ["300", "400", "500", "600", "700", "800"]);
