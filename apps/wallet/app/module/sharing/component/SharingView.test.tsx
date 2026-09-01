import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import i18next from "i18next";
import type { ReactNode } from "react";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SharingSearch } from "@/module/sharing/params/table";
import { SharingView } from "./SharingView";

const resolvedConfig = vi.fn();
vi.mock("@/module/common/hook/useMerchantResolvedConfig", () => ({
    useMerchantResolvedConfig: () => ({ data: resolvedConfig() }),
}));

vi.mock("@/module/sharing/params/fragment", () => ({
    useActivationParams: () => ({}),
}));

vi.mock("@/module/sharing/host/useHostBridge", () => ({
    useHostBridge: () => ({ returnToHost: () => false, canHandOff: false }),
}));

vi.mock("@/module/sharing/useSharingIdentity", () => ({
    useSharingIdentity: () => "550e8400-e29b-41d4-a716-446655440001",
}));

// The page itself is not under test; capture the resolved copy it is handed.
let lastTitle: string | undefined;
vi.mock("@frak-labs/wallet-shared/sharing", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/wallet-shared/sharing")
        >();
    return {
        ...actual,
        SharingPage: () => null,
        useSharingPageController: (
            input: Parameters<typeof actual.useSharingPageController>[0]
        ) => {
            lastTitle = input.t("sharing.title");
            return actual.useSharingPageController(input);
        },
    };
});

const merchantId = "550e8400-e29b-41d4-a716-446655440000";

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

const search = { merchantId } as SharingSearch;
const navigation = { toInstall: vi.fn(), toWallet: vi.fn() };

function renderView() {
    return render(<SharingView search={search} navigation={navigation} />, {
        wrapper,
    });
}

beforeAll(async () => {
    await i18next.use(initReactI18next).init({
        lng: "en",
        defaultNS: "translation",
        ns: ["translation", "customized", "common"],
        fallbackNS: ["customized", "common"],
        resources: {
            en: { common: { sharing: { title: "Bundled title" } } },
        },
    });
});

beforeEach(() => {
    lastTitle = undefined;
    resolvedConfig.mockReset();
});

describe("SharingView merchant translations", () => {
    it("uses a merchant's sharing.title override", () => {
        resolvedConfig.mockReturnValue({
            sdkConfig: { translations: { "sharing.title": "Merchant A copy" } },
        });

        renderView();

        expect(lastTitle).toBe("Merchant A copy");
    });

    it("falls back to the bundled copy when the merchant sets none", () => {
        resolvedConfig.mockReturnValue({ sdkConfig: {} });

        renderView();

        expect(lastTitle).toBe("Bundled title");
    });

    it("does not leak one merchant's override into the next", () => {
        resolvedConfig.mockReturnValue({
            sdkConfig: { translations: { "sharing.title": "Merchant A copy" } },
        });
        renderView().unmount();
        expect(lastTitle).toBe("Merchant A copy");

        resolvedConfig.mockReturnValue({ sdkConfig: {} });
        renderView();

        expect(lastTitle).toBe("Bundled title");
    });
});
