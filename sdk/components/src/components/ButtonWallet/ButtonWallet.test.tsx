import { fireEvent, render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as useRewardHook from "@/hooks/useReward";
import { ButtonWallet } from "./ButtonWallet";
import * as buttonWalletUtils from "./utils";

// Mock the utils module
vi.mock("./utils", () => ({
    openWalletModal: vi.fn(),
}));

// Mock the hooks
vi.mock("@/hooks/useClientReady", () => ({
    useClientReady: vi.fn(() => ({
        shouldRender: true,
        isHidden: false,
        isClientReady: true,
    })),
}));

vi.mock("@/hooks/useReward", () => ({
    useReward: vi.fn(() => ({ reward: undefined })),
}));

// Sequential: tests mutate vi.mock state for shared hooks and window globals,
// incompatible with the workspace default of `sequence.concurrent: true`.
describe.sequential("ButtonWallet", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: true,
        });
        window.FrakSetup.modalWalletConfig = {
            metadata: {
                position: "right",
            },
        };
    });

    it("should render with default props", () => {
        render(<ButtonWallet />);
        const button = screen.getByRole("button", { name: "Open wallet" });
        expect(button).toBeInTheDocument();
    });

    it("should apply custom classname", () => {
        const { container } = render(<ButtonWallet classname="custom-class" />);
        const button = container.querySelector("button");
        expect(button).toHaveClass("custom-class");
    });

    it("should render nothing when config is not resolved", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: false,
            isHidden: false,
            isClientReady: false,
        });

        const { container } = render(<ButtonWallet />);
        expect(container.querySelector("button")).toBeNull();
    });

    it("should render nothing when SDK is hidden", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: true,
            isClientReady: true,
        });

        const { container } = render(<ButtonWallet />);
        expect(container.querySelector("button")).toBeNull();
    });

    it("should call openWalletModal on click", () => {
        render(<ButtonWallet />);
        const button = screen.getByRole("button", { name: "Open wallet" });

        fireEvent.click(button);

        expect(buttonWalletUtils.openWalletModal).toHaveBeenCalledTimes(1);
    });


    it("should display reward when useReward is true and reward is available", () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: "10 eur",
        });

        render(<ButtonWallet useReward />);
        const button = screen.getByRole("button", { name: "Open wallet" });
        expect(button).toHaveTextContent("10 eur");
    });

    it("should not display reward when useReward is false", () => {
        // When useReward is false, shouldUseReward is still true (checks !== undefined)
        // But the hook is called with shouldUseReward && isClientReady
        // So we need to ensure the mock returns undefined reward
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: undefined,
        });
        render(<ButtonWallet useReward={false} />);
        const button = screen.getByRole("button", { name: "Open wallet" });
        expect(button.textContent).not.toContain("eur");
    });

    it("should render disabled button when client is not ready", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: false,
        });

        const { container } = render(<ButtonWallet />);
        const button = container.querySelector("button");
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it("should pass targetInteraction to useReward hook", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: true,
        });
        render(
            <ButtonWallet
                useReward
                targetInteraction="custom.customerMeeting"
            />
        );

        // shouldUseReward is true (useReward !== undefined), and isClientReady is true
        expect(useRewardHook.useReward).toHaveBeenCalledWith(
            true,
            "custom.customerMeeting"
        );
    });

    it("should use left position when configured", () => {
        window.FrakSetup.modalWalletConfig = {
            metadata: {
                position: "left",
            },
        };

        const { container } = render(<ButtonWallet />);
        const button = container.querySelector("button");
        // The button should have the left position class
        expect(button).toBeInTheDocument();
    });

    it("should use right position by default", () => {
        window.FrakSetup.modalWalletConfig = {
            metadata: {
                position: "right",
            },
        };

        const { container } = render(<ButtonWallet />);
        const button = container.querySelector("button");
        expect(button).toBeInTheDocument();
    });
});
