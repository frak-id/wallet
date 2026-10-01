import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
    update: vi.fn(),
    merchantName: "Acme",
    merchantStatus: "success" as "success" | "pending" | "error",
}));

vi.mock("@/module/merchant/hook/useMerchant", () => ({
    useMerchant: () => ({
        data:
            state.merchantStatus === "success"
                ? { name: state.merchantName }
                : undefined,
        isPending: state.merchantStatus === "pending",
    }),
}));
vi.mock("@/module/merchant/hook/useMerchantUpdate", async () => {
    const { useState } = await import("react");
    return {
        useMerchantUpdate: () => {
            const [isSuccess, setIsSuccess] = useState(false);
            return {
                mutateAsync: async (patch: unknown) => {
                    await state.update(patch);
                    setIsSuccess(true);
                },
                isPending: false,
                isSuccess,
            };
        },
    };
});
vi.mock("@/module/merchant/component/EditPageLayout", () => ({
    EditPageLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/module/merchant/component/MerchantDetailsCard", () => ({
    MerchantDetailsCard: () => null,
}));
vi.mock("./SdkIdentityPanel", () => ({ SdkIdentityPanel: () => null }));
vi.mock("./SharingWordingPanel", () => ({ SharingWordingPanel: () => null }));
vi.mock("./AmbassadorPagePanel", () => ({ AmbassadorPagePanel: () => null }));

beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
});

import { merchantSdkConfigQueryKey } from "@/module/merchant/queries/queryKeys";
import { CustomizePage } from "./index";

const GLOBAL = "customize.placements.globalDefault";
const ADD = "customize.placements.add";
const DISCARD_TITLE = "merchantEdit.discard.title";
const KEEP_EDITING = "merchantEdit.discard.keepEditing";
const INTERACTION = "customize.components.targetInteraction.label";

function renderPage(sdkConfig: SdkConfig) {
    const key = merchantSdkConfigQueryKey("merchant-1", false);
    const client = new QueryClient({
        defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
    });
    client.setQueryData(key, { sdkConfig });
    state.update.mockImplementation(async (patch: Partial<SdkConfig>) => {
        const current = client.getQueryData<{ sdkConfig: SdkConfig }>(key);
        client.setQueryData(key, {
            sdkConfig: { ...current?.sdkConfig, ...patch },
        });
    });
    render(
        <QueryClientProvider client={client}>
            <CustomizePage merchantId="merchant-1" />
        </QueryClientProvider>
    );
    return { client, key };
}

function openDropdown() {
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
}

function pick(name: string) {
    openDropdown();
    fireEvent.click(screen.getByRole("option", { name }));
}

function editGlobalComponents() {
    fireEvent.mouseDown(screen.getByText("customize.components.banner"));
    fireEvent.click(screen.getByText(/Shop with Acme and collect/));
}

function editPlacementInteraction() {
    fireEvent.change(screen.getByLabelText(INTERACTION), {
        target: { value: "purchase_completed" },
    });
}

function createPlacement(placementId: string) {
    pick(ADD);
    fireEvent.change(screen.getByPlaceholderText("homepage_banner"), {
        target: { value: placementId },
    });
    fireEvent.click(screen.getByText("customize.placements.dialog.create"));
}

describe("CustomizePage brand name", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.merchantName = "Acme";
        state.merchantStatus = "success";
    });

    it("waits for the merchant before rendering the editors", () => {
        state.merchantStatus = "pending";
        renderPage({});

        expect(screen.queryByText("customize.components.banner")).toBeNull();
    });

    it("still renders the editors when the merchant query fails", () => {
        state.merchantStatus = "error";
        renderPage({});

        fireEvent.mouseDown(screen.getByText("customize.components.banner"));

        expect(screen.getByText(/Shop with My Store and collect/)).toBeTruthy();
    });

    it("brands the placement card with the account name", () => {
        renderPage({ placements: { home: {} } });
        pick("home");

        fireEvent.mouseDown(screen.getByText("customize.components.banner"));

        expect(screen.getByText(/Shop with Acme and collect/)).toBeTruthy();
    });

    it("prefers the display name over the account name", () => {
        renderPage({ name: "Display" });

        fireEvent.mouseDown(screen.getByText("customize.components.banner"));

        expect(screen.getByText(/Shop with Display and collect/)).toBeTruthy();
    });

    it("falls back to My Store without a display or account name", () => {
        state.merchantName = "";
        renderPage({});

        fireEvent.mouseDown(screen.getByText("customize.components.banner"));

        expect(screen.getByText(/Shop with My Store and collect/)).toBeTruthy();
    });
});

describe("CustomizePage placement dropdown", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.merchantName = "Acme";
        state.merchantStatus = "success";
    });

    it("asks before leaving a dirty placement for the global settings", async () => {
        renderPage({ placements: { home: {} } });
        pick("home");
        editPlacementInteraction();

        pick(GLOBAL);

        expect(await screen.findByText(DISCARD_TITLE)).toBeTruthy();
    });

    it("asks before switching away from dirty global components", async () => {
        renderPage({ placements: { home: {} } });
        editGlobalComponents();

        pick("home");

        expect(await screen.findByText(DISCARD_TITLE)).toBeTruthy();
    });

    it("guards the switch to a new placement and keeps the edit on keep editing", async () => {
        renderPage({});
        editGlobalComponents();

        createPlacement("home");

        fireEvent.click(await screen.findByText(KEEP_EDITING));
        expect((await screen.findByRole("combobox")).textContent).toBe(GLOBAL);
        expect(screen.queryByText(DISCARD_TITLE)).toBeNull();
        openDropdown();
        expect(screen.getByRole("option", { name: "home" })).toBeTruthy();
    });

    it("selects the new placement once the switch is allowed", async () => {
        renderPage({});

        createPlacement("home");

        await waitFor(() =>
            expect(screen.getByRole("combobox").textContent).toBe("home")
        );
        expect(screen.getByLabelText(INTERACTION)).toBeTruthy();
    });

    it("selects a new placement before the config refetch lands", async () => {
        renderPage({});
        state.update.mockImplementation(async () => {});

        createPlacement("home");

        await waitFor(() =>
            expect(screen.getByRole("combobox").textContent).toBe("home")
        );
        expect(screen.getByLabelText(INTERACTION)).toBeTruthy();
    });

    it("creates a second placement from the same page", async () => {
        renderPage({});

        createPlacement("home");
        await waitFor(() =>
            expect(screen.getByRole("combobox").textContent).toBe("home")
        );
        createPlacement("cart");

        await waitFor(() =>
            expect(screen.getByRole("combobox").textContent).toBe("cart")
        );
        openDropdown();
        expect(screen.getByRole("option", { name: "home" })).toBeTruthy();
    });

    it("falls back to the global settings when the selected placement leaves the config", async () => {
        const { client, key } = renderPage({ placements: { home: {} } });
        pick("home");

        act(() => client.setQueryData(key, { sdkConfig: {} }));

        await waitFor(() =>
            expect(screen.getByRole("combobox").textContent).toBe(GLOBAL)
        );
    });

    it("returns to the global settings after a delete without a discard prompt", async () => {
        renderPage({ placements: { home: {} } });
        pick("home");
        editPlacementInteraction();

        fireEvent.click(screen.getByText("customize.placements.delete.action"));
        fireEvent.click(
            await screen.findByText("customize.placements.delete.confirm")
        );

        await waitFor(() =>
            expect(screen.getByRole("combobox").textContent).toBe(GLOBAL)
        );
        expect(state.update).toHaveBeenCalledWith({ placements: {} });
        expect(screen.queryByText(DISCARD_TITLE)).toBeNull();
    });
});
