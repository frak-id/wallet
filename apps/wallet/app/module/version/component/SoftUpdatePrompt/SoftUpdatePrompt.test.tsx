import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { SoftUpdatePrompt } from "@/module/version/component/SoftUpdatePrompt";
import type { NativeUpdateStatus } from "@/module/version/utils/nativeUpdater";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const {
    startNativeSoftUpdateMock,
    completeNativeSoftUpdateMock,
    openNativeStoreMock,
} = vi.hoisted(() => ({
    startNativeSoftUpdateMock: vi.fn(),
    completeNativeSoftUpdateMock: vi.fn(),
    openNativeStoreMock: vi.fn(),
}));

vi.mock("@/module/version/utils/nativeUpdater", () => ({
    startNativeSoftUpdate: startNativeSoftUpdateMock,
    completeNativeSoftUpdate: completeNativeSoftUpdateMock,
    openNativeStore: openNativeStoreMock,
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
        openNativeStoreMock.mockReset().mockResolvedValue(true);
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

    test("invalidates the native-status query (but keeps the data) on a single `started: false`", async () => {
        startNativeSoftUpdateMock.mockResolvedValue(false);
        const { client, wrapper } = createTestClient();
        const invalidateSpy = vi.spyOn(client, "invalidateQueries");
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
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ["version", "native-status"],
            });
        });
        expect(client.getQueryData(["version", "native-status"])).toEqual(
            seeded
        );
        expect(openNativeStoreMock).not.toHaveBeenCalled();
    });

    test("falls back to the store after repeated `started: false`", async () => {
        startNativeSoftUpdateMock.mockResolvedValue(false);
        const { wrapper } = createTestClient();

        render(<SoftUpdatePrompt mode="available" onDismiss={vi.fn()} />, {
            wrapper,
        });

        const button = await screen.findByRole("button", {
            name: "version.softUpdate.available.cta",
        });

        fireEvent.click(button);
        await waitFor(() =>
            expect(startNativeSoftUpdateMock).toHaveBeenCalledTimes(1)
        );
        // The mutation re-enables the button once it settles; wait for that
        // before the second tap so both attempts actually register.
        await waitFor(() =>
            expect((button as HTMLButtonElement).disabled).toBe(false)
        );

        fireEvent.click(button);
        await waitFor(() =>
            expect(openNativeStoreMock).toHaveBeenCalledTimes(1)
        );
        expect(startNativeSoftUpdateMock).toHaveBeenCalledTimes(2);
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

describe.sequential("SoftUpdatePrompt — DownloadedBanner", () => {
    beforeEach(() => {
        startNativeSoftUpdateMock.mockReset();
        completeNativeSoftUpdateMock.mockReset();
        openNativeStoreMock.mockReset().mockResolvedValue(true);
    });

    test("invalidates the native-status query when complete reports `completed: false`", async () => {
        completeNativeSoftUpdateMock.mockResolvedValue(false);
        const { client, wrapper } = createTestClient();
        const invalidateSpy = vi.spyOn(client, "invalidateQueries");

        render(<SoftUpdatePrompt mode="downloaded" />, { wrapper });

        fireEvent.click(
            await screen.findByRole("button", {
                name: "version.softUpdate.downloaded.cta",
            })
        );

        await waitFor(() => {
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: ["version", "native-status"],
            });
        });
    });

    test("does not invalidate when complete reports `completed: true`", async () => {
        completeNativeSoftUpdateMock.mockResolvedValue(true);
        const { client, wrapper } = createTestClient();
        const invalidateSpy = vi.spyOn(client, "invalidateQueries");

        render(<SoftUpdatePrompt mode="downloaded" />, { wrapper });

        fireEvent.click(
            await screen.findByRole("button", {
                name: "version.softUpdate.downloaded.cta",
            })
        );

        await waitFor(() =>
            expect(completeNativeSoftUpdateMock).toHaveBeenCalledTimes(1)
        );
        // Flush microtasks so onSuccess runs before asserting it stayed quiet.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(invalidateSpy).not.toHaveBeenCalled();
    });
});

describe.sequential("SoftUpdatePrompt — in_progress", () => {
    test("invokes onDismiss so a wedged progress banner can be hidden", async () => {
        const { wrapper } = createTestClient();
        const onDismiss = vi.fn();

        render(<SoftUpdatePrompt mode="in_progress" onDismiss={onDismiss} />, {
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
