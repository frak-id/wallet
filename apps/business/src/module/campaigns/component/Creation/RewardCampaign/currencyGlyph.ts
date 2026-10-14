import { createContext, use } from "react";

/** Reward-currency glyph (€/£/$) for `"amount"` units, shared across the step. */
export const CurrencyGlyphContext = createContext<string>("€");
export const useCurrencyGlyph = () => use(CurrencyGlyphContext);
