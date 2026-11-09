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

import { CustomizeSaveProvider } from "../saveRegistry";
import { RewardReminderPanel } from "./RewardReminderPanel";
import { SECTION_KEYS } from "./sections";

function renderPanel(sdkConfig: SdkConfig = {}) {
    const sections = new Map<string, () => Promise<void>>();
    render(
        <QueryClientProvider client={new QueryClient()}>
            <CustomizeSaveProvider
                value={{
                    registerSection: (key, submit) => {
                        sections.set(key, submit);
                        return () => sections.delete(key);
                    },
                    onDirtyChange: vi.fn(),
                }}
            >
                <RewardReminderPanel
                    merchantId="merchant-1"
                    sdkConfig={sdkConfig}
                />
            </CustomizeSaveProvider>
        </QueryClientProvider>
    );
    return async () => {
        const submit = sections.get(SECTION_KEYS.rewardReminder);
        if (!submit) throw new Error("reminder section never registered");
        await act(() => submit());
    };
}

describe("RewardReminderPanel", () => {
    beforeEach(() => vi.clearAllMocks());

    it("shows the reminder as on when nothing is stored", () => {
        renderPanel();

        expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
            "true"
        );
    });

    it("saves no reminder entry while left on and untouched", async () => {
        const save = renderPanel();
        await save();

        expect(editSdkConfig.mock.calls[0]?.[0].components).toEqual({
            rewardReminder: undefined,
        });
    });

    it("saves enabled: false once the switch is turned off", async () => {
        const save = renderPanel();
        fireEvent.click(screen.getByRole("switch"));
        await save();

        expect(
            editSdkConfig.mock.calls[0]?.[0].components.rewardReminder
        ).toEqual({ enabled: false });
    });

    it("keeps a stored enabled: false switched off", () => {
        renderPanel({ components: { rewardReminder: { enabled: false } } });

        expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
            "false"
        );
    });
});
