import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
    Trans: ({
        i18nKey,
        values,
    }: {
        i18nKey: string;
        values?: { total: number };
    }) => (
        <span>
            {i18nKey} {values?.total}
        </span>
    ),
}));
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: () => false,
}));
vi.mock("@/module/members/api/getMerchantMembers", () => ({
    getMerchantsMembersCount: vi.fn(),
}));
vi.mock("@/module/common/hook/useActiveMerchantId", () => ({
    useActiveMerchantId: () => "merchant-1",
}));
vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
}));

import { getMerchantsMembersCount } from "@/module/members/api/getMerchantMembers";
import { CreatePushNotification } from "./index";

const type = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("CreatePushNotification", () => {
    it("unlocks Publish when the audience is chosen after the content", async () => {
        vi.mocked(getMerchantsMembersCount).mockResolvedValue(42);
        render(
            <QueryClientProvider
                client={
                    new QueryClient({
                        defaultOptions: { queries: { retry: false } },
                    })
                }
            >
                <CreatePushNotification />
            </QueryClientProvider>
        );

        type("push.create.campaign.label", "Spring sale campaign");
        type(
            "push.create.content.notificationTitle.label*",
            "Spring sale starts"
        );
        type("push.create.content.message.label*", "Everything is 20% off");
        await waitFor(() =>
            expect(
                screen
                    .getByRole("button", { name: "push.create.publish" })
                    .hasAttribute("disabled")
            ).toBe(true)
        );
        fireEvent.click(
            screen.getByRole("checkbox", {
                name: "members.filters.interactions",
            })
        );
        fireEvent.change(
            screen.getByPlaceholderText("members.filters.minInteractions"),
            { target: { value: "1" } }
        );
        fireEvent.blur(
            screen.getByPlaceholderText("members.filters.minInteractions")
        );
        expect(
            await screen.findByText("push.create.audience.matched 42")
        ).toBeDefined();
        await waitFor(() =>
            expect(
                screen
                    .getByRole("button", { name: "push.create.publish" })
                    .hasAttribute("disabled")
            ).toBe(false)
        );
    });
});
