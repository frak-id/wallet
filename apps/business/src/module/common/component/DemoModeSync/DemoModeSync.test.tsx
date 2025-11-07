import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoModeSync } from "./index";

const mockUseDemoMode = vi.fn();

vi.mock("@/module/common/atoms/demoMode", () => ({
    useDemoMode: () => mockUseDemoMode(),
}));

describe("DemoModeSync", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call useDemoMode hook", () => {
        render(<DemoModeSync />);

        expect(mockUseDemoMode).toHaveBeenCalledTimes(1);
    });

    it("should return null", () => {
        const { container } = render(<DemoModeSync />);

        expect(container.firstChild).toBeNull();
    });

    it("should not render any visible content", () => {
        const { container } = render(<DemoModeSync />);

        expect(container.innerHTML).toBe("");
    });
});
