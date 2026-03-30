import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as useIsMobileHook from "@/hooks/useIsMobile";
import * as openInAppUtil from "@/utils/openInApp";
import { OpenInAppButton } from "./OpenInAppButton";

vi.mock("@/hooks/useClientReady", () => ({
    useClientReady: vi.fn(() => ({
        shouldRender: true,
        isHidden: false,
        isClientReady: true,
    })),
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
            shouldRender: true,
            isHidden: false,
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

    it("should render nothing when config is not resolved", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: false,
            isHidden: false,
            isClientReady: false,
        });

        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toBeNull();
    });

    it("should render nothing when SDK is hidden", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: true,
            isClientReady: true,
        });

        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toBeNull();
    });

    it("should render when config is resolved and not hidden", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: true,
        });
        const { container } = render(<OpenInAppButton />);
        const button = container.querySelector("button");
        expect(button).toBeInTheDocument();
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
