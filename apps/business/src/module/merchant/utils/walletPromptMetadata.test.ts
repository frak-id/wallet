import { describe, expect, it, vi } from "vitest";

const { loadEnglishBundle } = vi.hoisted(() => ({
    loadEnglishBundle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/i18n/loadBundle", () => ({ loadEnglishBundle }));
vi.mock("i18next", () => ({
    default: {
        t: (key: string, options?: { lng?: string }) =>
            `${key}|${options?.lng ?? "ui"}`,
    },
}));

import { walletPromptMetadata } from "./walletPromptMetadata";

describe("walletPromptMetadata", () => {
    it("titles in the dashboard language and describes in fr and en", async () => {
        const metadata = await walletPromptMetadata({
            titleKey: "funding.walletPrompt.withdraw.title",
            descriptionKey: "funding.walletPrompt.withdraw.description",
        });

        expect(loadEnglishBundle).toHaveBeenCalledOnce();
        expect(metadata.header.title).toBe(
            "funding.walletPrompt.withdraw.title|ui"
        );
        expect(metadata.i18n.fr["sdk.modal.sendTransaction.description"]).toBe(
            "funding.walletPrompt.withdraw.description|fr"
        );
        expect(metadata.i18n.en["sdk.modal.sendTransaction.description"]).toBe(
            "funding.walletPrompt.withdraw.description|en"
        );
    });
});
