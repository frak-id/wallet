import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as useIsMobileHook from "@/hooks/useIsMobile";
import * as openInAppUtil from "@/utils/openInApp";
import { OpenInAppButton } from "./OpenInAppButton";

vi.mock("@/hooks/useClientReady", () => ({
    useClientReady: vi.fn(() => ({ isClientReady: true })),
}));

vi.mock("@/hooks/useIsMobile", () => ({
    useIsMobile: vi.fn(() => ({ isMobile: true })),
}));

vi.mock("@/utils/openInApp", () => ({
    openFrakWalletApp: vi.fn(),
}));

describe("OpenInAppButton", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: true,
        });
        vi.mocked(useIsMobileHook.useIsMobile).mockReturnValue({
            isMobile: true,
        });
    });

    afterEach(() => {
        cleanup();
    });

    it("should render with default props on mobile", () => {
        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toHaveTextContent("Open in App");
    });

    it("should render with custom text", () => {
        const { container } = render(<OpenInAppButton text="Get the App" />);
        const button = container.querySelector("button");
        expect(button).toHaveTextContent("Get the App");
    });

    it("should apply custom classname", () => {
        const { container } = render(
            <OpenInAppButton classname="custom-class" />
        );
        const button = container.querySelector("button");
        expect(button).toHaveClass("custom-class");
    });

    it("should not render on desktop", () => {
        vi.mocked(useIsMobileHook.useIsMobile).mockReturnValue({
            isMobile: false,
        });

        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toBeNull();
    });

    it("should render on mobile", () => {
        vi.mocked(useIsMobileHook.useIsMobile).mockReturnValue({
            isMobile: true,
        });

        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toBeInTheDocument();
    });

    it("should display spinner when client is not ready", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: false,
        });

        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button?.querySelector("span")).toBeInTheDocument();
    });

    it("should be disabled when client is not ready", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: false,
        });

        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toBeDisabled();
    });

    it("should be enabled when client is ready", () => {
        // Reset mock to return ready state
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: true,
        });
        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).not.toBeDisabled();
    });

    it("should call openFrakWalletApp on click", () => {
        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");

        if (button) {
            fireEvent.click(button);
        }

        expect(openInAppUtil.openFrakWalletApp).toHaveBeenCalledTimes(1);
    });

    it("should have override class for styling", () => {
        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toHaveClass("override");
    });
});
