import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const editSdkConfig = vi.fn().mockResolvedValue(undefined);
vi.mock("@/module/merchant/hook/useMerchantUpdate", () => ({
    useMerchantUpdate: () => ({ mutateAsync: editSdkConfig, isSuccess: false }),
}));

import { merchantSdkConfigQueryKey } from "@/module/merchant/queries/queryKeys";
import { CustomizeSaveProvider } from "../saveRegistry";
import { DefaultCustomization } from "./DefaultCustomization";
import { SECTION_KEYS } from "./sections";

function queryClientWith(sdkConfig: SdkConfig) {
    const client = new QueryClient();
    client.setQueryData(merchantSdkConfigQueryKey("merchant-1", false), {
        sdkConfig,
    });
    return client;
}

function renderPanel(sdkConfig: SdkConfig, shopName = "My Store") {
    const sections = new Map<string, () => Promise<void>>();
    render(
        <QueryClientProvider client={queryClientWith(sdkConfig)}>
            <CustomizeSaveProvider
                value={{
                    registerSection: (key, submit) => {
                        sections.set(key, submit);
                        return () => sections.delete(key);
                    },
                    onDirtyChange: () => {},
                }}
            >
                <DefaultCustomization
                    merchantId="merchant-1"
                    sdkConfig={sdkConfig}
                    shopName={shopName}
                />
            </CustomizeSaveProvider>
        </QueryClientProvider>
    );
    const submit = sections.get(SECTION_KEYS.defaultComponents);
    if (!submit) throw new Error("components section never registered");
    return submit;
}

function openBannerTab() {
    fireEvent.mouseDown(screen.getByText("customize.components.banner"));
}

async function saveComponents(sdkConfig: SdkConfig) {
    const submit = renderPanel(sdkConfig);
    await act(() => submit());
    return editSdkConfig.mock.calls[0]?.[0].components;
}

describe("DefaultCustomization save", () => {
    beforeEach(() => vi.clearAllMocks());

    it("keeps the stored ambassador, floating wallet and open-in-app entries", async () => {
        const ambassador = { heroTitle: "Join us", heroImageUrl: "none" };
        const components = await saveComponents({
            components: {
                ambassador,
                buttonWallet: { position: "left" },
                openInApp: { text: "Open" },
                buttonShare: { text: "Share" },
            },
        });

        expect(components.ambassador).toEqual(ambassador);
        expect(components.buttonWallet).toEqual({ position: "left" });
        expect(components.openInApp).toEqual({ text: "Open" });
        expect(components.buttonShare.text).toBe("Share");
    });

    it("saves only the three editor entries when nothing was stored", async () => {
        const components = await saveComponents({});

        expect(Object.keys(components).sort()).toEqual([
            "banner",
            "buttonShare",
            "postPurchase",
        ]);
    });

    it("brands a banner tone with the passed shop name, not the display name", async () => {
        const submit = renderPanel({ name: "Display" }, "frak-dev-08");
        openBannerTab();
        fireEvent.click(screen.getByText(/Shop with frak-dev-08 and collect/));
        await act(() => submit());

        const saved = editSdkConfig.mock.calls[0]?.[0].components.banner;
        expect(saved.referralDescription.en).toBe(
            "Shop with frak-dev-08 and collect your reward after purchase."
        );
    });

    it("previews the passed shop name rather than the display name", () => {
        renderPanel(
            {
                name: "Display",
                components: {
                    banner: {
                        referralDescription: "Welcome to {{productName}}",
                    },
                },
            },
            "frak-dev-08"
        );
        openBannerTab();

        expect(screen.getByText("Welcome to frak-dev-08")).toBeTruthy();
    });
});
