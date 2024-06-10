import type { BuiltInteraction } from "@/types/Interaction";
import { type Address, type Hex, concatHex, pad } from "viem";

// Denominator for the press content type
const PressTypeSelector = "0x02";

// The press action selectors
const ActionSelectors = {
    OpenArticle: "0xc0a24ffb",
    ReadArticle: "0xd5bd0fbe",
    Referred: "0x3d1508ad",
} as const;

// Build a press article interaction
function buildOpenArticle({ articleId }: { articleId: Hex }): BuiltInteraction {
    const facetData = concatHex([
        ActionSelectors.OpenArticle,
        pad(articleId, { size: 32 }),
    ]);
    const interactionData = concatHex([PressTypeSelector, facetData]);
    return {
        facetData,
        interactionData,
    };
}

// Build a press article interaction
function buildReadArticle({ articleId }: { articleId: Hex }): BuiltInteraction {
    const facetData = concatHex([
        ActionSelectors.ReadArticle,
        pad(articleId, { size: 32 }),
    ]);
    const interactionData = concatHex([PressTypeSelector, facetData]);
    return {
        facetData,
        interactionData,
    };
}

// Build a press article interaction
function buildReferred({ referrer }: { referrer: Address }): BuiltInteraction {
    const facetData = concatHex([
        ActionSelectors.Referred,
        pad(referrer, { size: 32 }),
    ]);
    const interactionData = concatHex([PressTypeSelector, facetData]);
    return {
        facetData,
        interactionData,
    };
}

export const PressInteraction = {
    buildOpenArticle,
    buildReadArticle,
    buildReferred,
};
