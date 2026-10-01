import { currentStablecoins } from "@frak-labs/app-essentials";
import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts ? `${key}${JSON.stringify(opts)}` : key,
    }),
}));

const editSdkConfig = vi.fn().mockResolvedValue(undefined);
vi.mock("@/module/merchant/hook/useMerchantUpdate", () => ({
    useMerchantUpdate: () => ({ mutateAsync: editSdkConfig, isSuccess: false }),
}));

vi.mock("@/module/merchant/hook/useMediaUpload", () => ({
    useMediaUpload: () => ({
        mutate: vi.fn(),
        isPending: false,
        error: null,
        isSuccess: false,
        reset: vi.fn(),
    }),
    useMediaList: () => ({ data: [] }),
}));

let merchant: { name: string; defaultRewardToken: string } | undefined;
vi.mock("@/module/merchant/hook/useMerchant", () => ({
    useMerchant: () => ({ data: merchant }),
}));

import { CustomizeSaveProvider } from "../saveRegistry";
import { SdkIdentityPanel } from "./SdkIdentityPanel";
import { SECTION_KEYS } from "./sections";

function renderPanel(sdkConfig: SdkConfig = {}) {
    const sections = new Map<string, () => Promise<void>>();
    const onDirtyChange = vi.fn();
    render(
        <QueryClientProvider client={new QueryClient()}>
            <CustomizeSaveProvider
                value={{
                    registerSection: (key, submit) => {
                        sections.set(key, submit);
                        return () => sections.delete(key);
                    },
                    onDirtyChange,
                }}
            >
                <SdkIdentityPanel
                    merchantId="merchant-1"
                    sdkConfig={sdkConfig}
                />
            </CustomizeSaveProvider>
        </QueryClientProvider>
    );
    const save = async () => {
        const submit = sections.get(SECTION_KEYS.identity);
        if (!submit) throw new Error("identity section never registered");
        await act(() => submit());
    };
    return { save, onDirtyChange };
}

describe("SdkIdentityPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        merchant = {
            name: "frak-dev-08",
            defaultRewardToken: currentStablecoins.usdc,
        };
    });

    it("renders the brand card title and description", () => {
        renderPanel();

        expect(screen.getByText("customize.identity.title")).toBeTruthy();
        expect(screen.getByText("customize.identity.description")).toBeTruthy();
    });

    it("uses the account name as the display name placeholder", () => {
        renderPanel({ name: undefined });

        const input = screen.getByLabelText("customize.identity.name.label");
        expect(input.getAttribute("placeholder")).toBe("frak-dev-08");
    });

    it("names the reward token in the currency hint", () => {
        renderPanel();

        expect(
            screen.getByText(/customize\.identity\.currency\.hint.*USDC/)
        ).toBeTruthy();
    });

    it("saves the typed display name", async () => {
        const { save, onDirtyChange } = renderPanel();

        fireEvent.change(
            screen.getByLabelText("customize.identity.name.label"),
            { target: { value: "My Brand" } }
        );
        await waitFor(() => expect(onDirtyChange).toHaveBeenCalled());
        await save();

        expect(editSdkConfig.mock.calls[0]?.[0].name).toBe("My Brand");
    });
});
