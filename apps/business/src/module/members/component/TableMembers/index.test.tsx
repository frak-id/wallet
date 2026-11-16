import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));
vi.mock("@/module/common/hook/useActiveMerchantId", () => ({
    useActiveMerchantId: () => "m1",
}));
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: () => false,
}));
vi.mock("@/module/members/api/getMerchantMembers", () => ({
    getMerchantMembers: vi.fn().mockRejectedValue(new Error("boom")),
}));

import { TableMembers } from "./index";

describe("TableMembers", () => {
    it("keeps the filters on screen when the members request fails", async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        render(
            <QueryClientProvider client={queryClient}>
                <TableMembers />
            </QueryClientProvider>
        );

        expect(await screen.findByText("errors.dataLoad.title")).toBeDefined();
        expect(
            screen.getByRole("button", { name: /members\.filters\.button/ })
        ).toBeDefined();
    });
});
