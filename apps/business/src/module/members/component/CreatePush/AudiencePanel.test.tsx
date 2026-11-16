import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
    FormProvider,
    useForm,
    useFormContext,
    useWatch,
} from "react-hook-form";
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

import { getMerchantsMembersCount } from "@/module/members/api/getMerchantMembers";
import { AudiencePanel } from "./AudiencePanel";
import type { FormCreatePushNotification } from "./types";

function TargetCount() {
    const targetCount = useWatch<FormCreatePushNotification, "targetCount">({
        name: "targetCount",
    });
    return <output data-testid="target-count">{targetCount}</output>;
}

function ChangeFilter() {
    const { setValue } = useFormContext<FormCreatePushNotification>();
    return (
        <button
            type="button"
            onClick={() =>
                setValue("target.filter", { interactions: { min: 3 } })
            }
        >
            change filter
        </button>
    );
}

function Harness({ children }: { children: ReactNode }) {
    const form = useForm<FormCreatePushNotification>({
        defaultValues: {
            target: { filter: {} },
            targetCount: 5,
            pushCampaignTitle: "",
            payload: { title: "" },
            schedule: { type: "", date: "", time: "" },
        },
    });
    return <FormProvider {...form}>{children}</FormProvider>;
}

describe("AudiencePanel", () => {
    it("shows a retry instead of a fake 0 when the count fails, and recovers", async () => {
        vi.mocked(getMerchantsMembersCount)
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValue(42);
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        render(
            <QueryClientProvider client={queryClient}>
                <Harness>
                    <AudiencePanel />
                    <TargetCount />
                </Harness>
            </QueryClientProvider>
        );

        expect(
            await screen.findByText("push.create.audience.countError")
        ).toBeDefined();
        expect(screen.queryByText("members.audience.minMember")).toBeNull();
        expect(screen.getByTestId("target-count").textContent).toBe("0");

        fireEvent.click(
            screen.getByRole("button", { name: "errors.boundary.retry" })
        );

        expect(
            await screen.findByText("push.create.audience.matched 42")
        ).toBeDefined();
        expect(
            screen.queryByText("push.create.audience.countError")
        ).toBeNull();
        expect(screen.getByTestId("target-count").textContent).toBe("42");
    });

    it("locks the form count while a new filter's count is loading", async () => {
        vi.mocked(getMerchantsMembersCount)
            .mockResolvedValueOnce(10)
            .mockReturnValue(new Promise(() => {}));
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        render(
            <QueryClientProvider client={queryClient}>
                <Harness>
                    <AudiencePanel />
                    <TargetCount />
                    <ChangeFilter />
                </Harness>
            </QueryClientProvider>
        );

        expect(
            await screen.findByText("push.create.audience.matched 10")
        ).toBeDefined();
        expect(screen.getByTestId("target-count").textContent).toBe("10");

        fireEvent.click(screen.getByRole("button", { name: "change filter" }));

        await waitFor(() =>
            expect(screen.getByTestId("target-count").textContent).toBe("0")
        );
        expect(
            screen.getByText("push.create.audience.matched 10")
        ).toBeDefined();
    });

    it("keeps the error and a busy Try Again while the retry is in flight", async () => {
        vi.mocked(getMerchantsMembersCount)
            .mockRejectedValueOnce(new Error("boom"))
            .mockReturnValue(new Promise(() => {}));
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        render(
            <QueryClientProvider client={queryClient}>
                <Harness>
                    <AudiencePanel />
                </Harness>
            </QueryClientProvider>
        );

        const retry = await screen.findByRole("button", {
            name: "errors.boundary.retry",
        });
        expect(retry.hasAttribute("disabled")).toBe(false);
        fireEvent.click(retry);

        await waitFor(() =>
            expect(
                screen
                    .getByRole("button", { name: "errors.boundary.retry" })
                    .hasAttribute("disabled")
            ).toBe(true)
        );
        expect(
            screen.getByText("push.create.audience.countError")
        ).toBeDefined();
        expect(
            screen.queryByText(/push\.create\.audience\.matched/)
        ).toBeNull();
    });
});
