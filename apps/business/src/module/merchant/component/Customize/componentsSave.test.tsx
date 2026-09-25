import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const editSdkConfig = vi.fn().mockResolvedValue(undefined);
vi.mock("@/module/merchant/hook/useMerchantUpdate", () => ({
    useMerchantUpdate: () => ({ mutateAsync: editSdkConfig, isSuccess: false }),
}));

import { merchantSdkConfigQueryKey } from "@/module/merchant/queries/queryKeys";
import { CustomizeSaveProvider } from "../saveRegistry";
import { AmbassadorPagePanel } from "./AmbassadorPagePanel";
import { DefaultCustomization } from "./DefaultCustomization";
import { SECTION_KEYS } from "./sections";

describe("one page-level Save with both components sections dirty", () => {
    it("keeps the ambassador edit when the components editor saves after it", async () => {
        const sdkConfig: SdkConfig = {
            components: { ambassador: { heroTitle: "Old" } },
        };
        const queryClient = new QueryClient();
        queryClient.setQueryData(
            merchantSdkConfigQueryKey("merchant-1", false),
            {
                sdkConfig,
            }
        );
        const sections = new Map<string, () => Promise<void>>();
        render(
            <QueryClientProvider client={queryClient}>
                <CustomizeSaveProvider
                    value={{
                        registerSection: (key, submit) => {
                            sections.set(key, submit);
                            return () => sections.delete(key);
                        },
                        onDirtyChange: () => {},
                    }}
                >
                    <AmbassadorPagePanel
                        merchantId="merchant-1"
                        sdkConfig={sdkConfig}
                        shopName="My Store"
                        explorerHeroImageUrl={undefined}
                    />
                    <DefaultCustomization
                        merchantId="merchant-1"
                        sdkConfig={sdkConfig}
                    />
                </CustomizeSaveProvider>
            </QueryClientProvider>
        );

        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.heroTitle"),
            { target: { value: "New" } }
        );
        await act(async () => {
            await sections.get(SECTION_KEYS.ambassador)?.();
            await sections.get(SECTION_KEYS.defaultComponents)?.();
        });

        const lastPut = editSdkConfig.mock.calls.at(-1)?.[0];
        expect(lastPut.components.ambassador).toEqual({ heroTitle: "New" });
    });
});
