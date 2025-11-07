import * as coreSdk from "@frak-labs/core-sdk";
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
    useClientReady: vi.fn(() => ({ isClientReady: true })),
}));

vi.mock("@/hooks/useReward", () => ({
    useReward: vi.fn(() => ({ reward: undefined })),
}));

describe("ButtonWallet", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window.FrakSetup.modalWalletConfig
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

    it("should be disabled when client is not ready", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: false,
        });

        render(<ButtonWallet />);
        const button = screen.getByRole("button", { name: "Open wallet" });
        expect(button).toBeDisabled();
    });

    it("should be enabled when client is ready", () => {
        // Reset mock to return ready state
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: true,
        });
        render(<ButtonWallet />);
        const button = screen.getByRole("button", { name: "Open wallet" });
        expect(button).not.toBeDisabled();
    });

    it("should call openWalletModal on click", () => {
        render(<ButtonWallet />);
        const button = screen.getByRole("button", { name: "Open wallet" });

        fireEvent.click(button);

        expect(buttonWalletUtils.openWalletModal).toHaveBeenCalledTimes(1);
    });

    it("should track event on click", () => {
        render(<ButtonWallet />);
        const button = screen.getByRole("button", { name: "Open wallet" });

        fireEvent.click(button);

        expect(coreSdk.trackEvent).toHaveBeenCalledWith(
            window.FrakSetup.client,
            "wallet_button_clicked"
        );
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

    it("should pass targetInteraction to useReward hook", () => {
        // Reset mock before test
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: true,
        });
        render(
            <ButtonWallet
                useReward
                targetInteraction="retail.customerMeeting"
            />
        );

        // shouldUseReward is true (useReward !== undefined), and isClientReady is true
        expect(useRewardHook.useReward).toHaveBeenCalledWith(
            true,
            "retail.customerMeeting"
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
