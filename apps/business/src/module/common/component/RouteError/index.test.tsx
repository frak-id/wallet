import {
    QueryClient,
    QueryClientProvider,
    useSuspenseQuery,
} from "@tanstack/react-query";
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataLoadError } from "./index";

describe("DataLoadError", () => {
    it("retry refetches a suspense query that failed", async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValue("loaded");
        function Page() {
            const { data } = useSuspenseQuery({
                queryKey: ["retry-test"],
                queryFn: fetcher,
            });
            return <p>{data}</p>;
        }
        const root = createRootRoute();
        const page = createRoute({
            getParentRoute: () => root,
            path: "/",
            component: Page,
            errorComponent: (props) => (
                <DataLoadError {...props} resourceName="campaigns" />
            ),
        });
        const router = createRouter({
            routeTree: root.addChildren([page]),
            history: createMemoryHistory({ initialEntries: ["/"] }),
        });

        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        );
        fireEvent.click(await screen.findByRole("button"));

        expect(await screen.findByText("loaded")).toBeDefined();
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});
