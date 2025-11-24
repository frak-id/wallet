import * as coreSdk from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as useRewardHook from "@/hooks/useReward";
import { ButtonShare } from "./ButtonShare";
import * as useShareModalHook from "./hooks/useShareModal";

// Mock the hooks
vi.mock("@/hooks/useClientReady", () => ({
    useClientReady: vi.fn(() => ({ isClientReady: true })),
}));

vi.mock("@/hooks/useReward", () => ({
    useReward: vi.fn(() => ({ reward: undefined })),
}));

vi.mock("./hooks/useShareModal", () => ({
    useShareModal: vi.fn(() => ({
        handleShare: vi.fn().mockResolvedValue(undefined),
        isError: false,
        debugInfo: undefined,
    })),
}));

describe("ButtonShare", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mocks to default state
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: true,
        });
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: undefined,
        });
        vi.mocked(useShareModalHook.useShareModal).mockReturnValue({
            handleShare: vi.fn().mockResolvedValue(undefined),
            isError: false,
            debugInfo: undefined,
        });
    });

    it("should render with default props", () => {
        render(<ButtonShare />);
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Share and earn!");
    });

    it("should render with custom text", () => {
        render(<ButtonShare text="Custom share text" />);
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Custom share text");
    });

    it("should apply custom classname", () => {
        const { container } = render(<ButtonShare classname="custom-class" />);
        const button = container.querySelector("button");
        expect(button).toHaveClass("custom-class");
    });

    it("should display spinner when client is not ready", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            isClientReady: false,
        });

        render(<ButtonShare />);
        const button = screen.getByRole("button");
        // Spinner should be rendered (check for spinner element)
        expect(button.querySelector("span")).toBeInTheDocument();
    });

    it("should not display spinner when client is ready", () => {
        render(<ButtonShare />);
        const button = screen.getByRole("button");
        // When client is ready, spinner should not be visible
        expect(button).toHaveTextContent("Share and earn!");
    });

    it("should display reward when useReward is true and reward is available", () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: "10 eur",
        });

        render(<ButtonShare useReward text="Earn up to {REWARD}!" />);
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Earn up to 10 eur!");
    });

    it("should use noRewardText when reward is not available", () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: undefined,
        });

        render(
            <ButtonShare
                useReward
                text="Earn up to {REWARD}!"
                noRewardText="Share and earn!"
            />
        );
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Share and earn!");
    });

    it("should append reward to text when placeholder is not present", () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: "10 eur",
        });

        render(<ButtonShare useReward text="Share and earn!" />);
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Share and earn! 10 eur");
    });

    it("should call handleShare on click when showWallet is false", async () => {
        const mockHandleShare = vi.fn().mockResolvedValue(undefined);
        vi.mocked(useShareModalHook.useShareModal).mockReturnValue({
            handleShare: mockHandleShare,
            isError: false,
            debugInfo: undefined,
        });

        render(<ButtonShare />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        await waitFor(() => {
            expect(mockHandleShare).toHaveBeenCalledTimes(1);
        });
    });

    it("should call displayEmbeddedWallet when showWallet is true", async () => {
        render(<ButtonShare showWallet />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        await waitFor(() => {
            expect(coreSdkActions.displayEmbeddedWallet).toHaveBeenCalledWith(
                window.FrakSetup.client,
                window.FrakSetup.modalWalletConfig ?? {}
            );
        });
    });

    it("should track event on click", () => {
        render(<ButtonShare />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        expect(coreSdk.trackEvent).toHaveBeenCalledWith(
            window.FrakSetup.client,
            "share_button_clicked"
        );
    });

    it("should display error message when isError is true", () => {
        vi.mocked(useShareModalHook.useShareModal).mockReturnValue({
            handleShare: vi.fn(),
            isError: true,
            debugInfo: "Error debug info",
        });

        render(<ButtonShare />);
        // ErrorMessage component should be rendered
        expect(
            screen.getByText(/Oups ! Nous avons rencontré/)
        ).toBeInTheDocument();
    });

    it("should not display error message when isError is false", () => {
        render(<ButtonShare />);
        expect(
            screen.queryByText(/Oups ! Nous avons rencontré/)
        ).not.toBeInTheDocument();
    });

    it("should pass targetInteraction to useReward hook", () => {
        render(
            <ButtonShare useReward targetInteraction="retail.customerMeeting" />
        );

        expect(useRewardHook.useReward).toHaveBeenCalledWith(
            true,
            "retail.customerMeeting"
        );
    });

    it("should pass targetInteraction to useShareModal hook", () => {
        render(<ButtonShare targetInteraction="retail.customerMeeting" />);

        expect(useShareModalHook.useShareModal).toHaveBeenCalledWith(
            "retail.customerMeeting"
        );
    });
});
