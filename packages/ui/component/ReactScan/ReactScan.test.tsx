import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReactScan } from "./index";

// Mock react-scan - must be defined inside factory function
vi.mock("react-scan", () => {
    const mockScan = vi.fn();
    const mockStore = {
        isInIframe: {
            value: true,
        },
    };
    return {
        Store: mockStore,
        scan: mockScan,
    };
});

describe("ReactScan", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset Store value before each test
        const { Store } = await import("react-scan");
        Store.isInIframe.value = true;
    });

    it("should render nothing", () => {
        const { container } = render(<ReactScan />);
        expect(container.firstChild).toBeNull();
    });

    it("should set isInIframe to false and call scan on mount", async () => {
        const { scan, Store } = await import("react-scan");

        render(<ReactScan />);

        // Wait for useEffect to run
        await waitFor(() => {
            expect(Store.isInIframe.value).toBe(false);
            expect(scan).toHaveBeenCalledWith({
                enabled: true,
                log: false,
            });
        });
    });

    it("should call scan only once on mount", async () => {
        const { scan } = await import("react-scan");

        const { rerender } = render(<ReactScan />);

        await waitFor(() => {
            expect(scan).toHaveBeenCalledTimes(1);
        });

        const initialCallCount = (scan as ReturnType<typeof vi.fn>).mock.calls
            .length;

        rerender(<ReactScan />);

        // Wait a bit to ensure useEffect doesn't run again
        await new Promise((resolve) => setTimeout(resolve, 100));

        // scan should still be called only once (useEffect dependency array is empty)
        expect((scan as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
            initialCallCount
        );
    });
});
