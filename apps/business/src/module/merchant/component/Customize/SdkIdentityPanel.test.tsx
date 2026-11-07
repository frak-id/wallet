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
        i18n: { language: "en" },
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

let rates: Record<string, number> | null = { eur: 0.9, usd: 1, gbp: 0.8 };
vi.mock("@/module/common/hook/useConversionRate", () => ({
    useConversionRate: () => ({ data: rates }),
}));

vi.mock("@/module/merchant/hook/useSdkConfig", () => ({
    useSdkConfig: () => ({ data: undefined }),
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
        rates = { eur: 0.9, usd: 1, gbp: 0.8 };
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

    it("labels Auto without promising a currency", () => {
        renderPanel();

        expect(
            screen.getByText("customize.identity.currency.auto")
        ).toBeTruthy();
    });

    it("words the notice as a default while the field is Auto", () => {
        renderPanel();

        expect(screen.getByRole("status").textContent).toContain(
            '"context":"auto"'
        );
    });

    it("words the notice plainly once a currency is picked", () => {
        renderPanel({ currency: "gbp" });

        expect(screen.getByRole("status").textContent).not.toContain(
            '"context"'
        );
    });

    it("explains the conversion when visitors see another fiat than the payout", () => {
        renderPanel();

        const notice = screen.getByRole("status");
        expect(notice.textContent).toContain(
            "displayConversion.notice.withRate"
        );
        expect(notice.textContent).toContain(
            '"displayFiat":"displayConversion.fiat.eur"'
        );
        expect(notice.textContent).toContain(
            '"payoutFiat":"displayConversion.fiat.usd"'
        );
        expect(notice.textContent).toContain('"token":"USDC"');
        expect(notice.textContent).toContain("$1 = €0.90");
    });

    it("drops the rate from the notice when none is available", () => {
        rates = null;
        renderPanel();

        expect(screen.getByRole("status").textContent).toContain(
            "displayConversion.notice.withoutRate"
        );
    });

    it("names the payout currency instead when it is also the display currency", () => {
        merchant = {
            name: "frak-dev-08",
            defaultRewardToken: currentStablecoins.eure,
        };
        renderPanel();

        expect(screen.queryByRole("status")).toBeNull();
        expect(
            screen.getByText(/displayConversion\.sameCurrency.*EURe/)
        ).toBeTruthy();
    });

    it("switches the display currency to the payout fiat and saves it", async () => {
        const { save, onDirtyChange } = renderPanel();

        fireEvent.click(
            screen.getByRole("button", {
                name: /displayConversion\.notice\.switch/,
            })
        );
        await waitFor(() =>
            expect(onDirtyChange).toHaveBeenCalledWith(
                SECTION_KEYS.identity,
                true
            )
        );
        expect(screen.queryByRole("status")).toBeNull();
        await save();

        expect(editSdkConfig.mock.calls[0]?.[0].currency).toBe("usd");
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
