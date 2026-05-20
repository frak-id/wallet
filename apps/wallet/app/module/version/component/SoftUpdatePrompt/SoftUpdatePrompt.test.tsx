import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { SoftUpdatePrompt } from "@/module/version/component/SoftUpdatePrompt";
import type { NativeUpdateStatus } from "@/module/version/utils/nativeUpdater";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const { startNativeSoftUpdateMock, completeNativeSoftUpdateMock } = vi.hoisted(
    () => ({
        startNativeSoftUpdateMock: vi.fn(),
        completeNativeSoftUpdateMock: vi.fn(),
    })
);

vi.mock("@/module/version/utils/nativeUpdater", () => ({
    startNativeSoftUpdate: startNativeSoftUpdateMock,
    completeNativeSoftUpdate: completeNativeSoftUpdateMock,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

/**
 * Local query client per test. The shared `queryWrapper` fixture sets
 * `gcTime: 0`, which is fine for `useQuery`-driven tests but immediately
 * garbage-collects `setQueryData` entries with no observer — and
 * `SoftUpdatePrompt` only touches the cache via `useMutation` /
 * `useQueryClient`, never `useQuery`. Keeping a default `gcTime` keeps the
 * seeded snapshot alive long enough to verify the optimistic-update
 * behaviour.
 */
function createTestClient(): {
    client: QueryClient;
    wrapper: (props: { children: ReactNode }) => ReactNode;
} {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

describe.sequential("SoftUpdatePrompt — AvailableBanner", () => {
    beforeEach(() => {
        startNativeSoftUpdateMock.mockReset();
        completeNativeSoftUpdateMock.mockReset();
    });

    test("flips the native-status cache to in_progress, preserving currentVersion", async () => {
        startNativeSoftUpdateMock.mockResolvedValue(true);
        const { client, wrapper } = createTestClient();
        const seeded: NativeUpdateStatus = {
            status: "available",
            currentVersion: "1.2.3",
            storeVersion: "1.2.4",
        };
        client.setQueryData(["version", "native-status"], seeded);

        render(<SoftUpdatePrompt mode="available" onDismiss={vi.fn()} />, {
            wrapper,
        });

        fireEvent.click(
            await screen.findByRole("button", {
                name: "version.softUpdate.available.cta",
            })
        );

        await waitFor(() => {
            expect(client.getQueryData(["version", "native-status"])).toEqual({
                status: "in_progress",
                currentVersion: "1.2.3",
                bytesDownloaded: 0,
                totalBytes: 0,
            } satisfies NativeUpdateStatus);
        });
        expect(startNativeSoftUpdateMock).toHaveBeenCalledTimes(1);
    });

    test("leaves the cache untouched when the native start call reports `started: false`", async () => {
        startNativeSoftUpdateMock.mockResolvedValue(false);
        const { client, wrapper } = createTestClient();
        const seeded: NativeUpdateStatus = {
            status: "available",
            currentVersion: "1.2.3",
        };
        client.setQueryData(["version", "native-status"], seeded);

        render(<SoftUpdatePrompt mode="available" onDismiss={vi.fn()} />, {
            wrapper,
        });

        fireEvent.click(
            await screen.findByRole("button", {
                name: "version.softUpdate.available.cta",
            })
        );

        await waitFor(() => {
            expect(startNativeSoftUpdateMock).toHaveBeenCalledTimes(1);
        });
        // Flush pending microtasks so the mutation's onSuccess has had its
        // turn before we assert the cache is still the seeded value.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(client.getQueryData(["version", "native-status"])).toEqual(
            seeded
        );
    });

    test("falls back to an empty currentVersion when no prior cache entry exists", async () => {
        startNativeSoftUpdateMock.mockResolvedValue(true);
        const { client, wrapper } = createTestClient();

        render(<SoftUpdatePrompt mode="available" onDismiss={vi.fn()} />, {
            wrapper,
        });

        fireEvent.click(
            await screen.findByRole("button", {
                name: "version.softUpdate.available.cta",
            })
        );

        await waitFor(() => {
            expect(
                client.getQueryData(["version", "native-status"])
            ).toMatchObject({
                status: "in_progress",
                currentVersion: "",
                bytesDownloaded: 0,
                totalBytes: 0,
            });
        });
    });

    test("invokes onDismiss when the secondary CTA is clicked", async () => {
        const { wrapper } = createTestClient();
        const onDismiss = vi.fn();

        render(<SoftUpdatePrompt mode="available" onDismiss={onDismiss} />, {
            wrapper,
        });

        fireEvent.click(
            await screen.findByRole("button", {
                name: "version.softUpdate.dismiss",
            })
        );

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
