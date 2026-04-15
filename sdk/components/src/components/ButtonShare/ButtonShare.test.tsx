import * as coreSdk from "@frak-labs/core-sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as useRewardHook from "@/hooks/useReward";
import * as embeddedWalletUtils from "@/utils/embeddedWallet";
import * as sharingPageUtils from "@/utils/sharingPage";
import { ButtonShare } from "./ButtonShare";
import * as useShareModalHook from "./hooks/useShareModal";

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

vi.mock("./hooks/useShareModal", () => ({
    useShareModal: vi.fn(() => ({
        handleShare: vi.fn().mockResolvedValue(undefined),
        isError: false,
        debugInfo: undefined,
    })),
}));

vi.mock("@/utils/embeddedWallet", () => ({
    openEmbeddedWallet: vi.fn(),
}));

vi.mock("@/utils/sharingPage", () => ({
    openSharingPage: vi.fn(),
}));

// Sequential: tests mutate vi.mock state for shared hooks and window globals,
// incompatible with the workspace default of `sequence.concurrent: true`.
describe.sequential("ButtonShare", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mocks to default state
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
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

    it("should render nothing when config is not resolved", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: false,
            isHidden: false,
            isClientReady: false,
        });

        const { container } = render(<ButtonShare />);
        expect(container.querySelector("button")).not.toBeInTheDocument();
    });

    it("should render nothing when SDK is hidden", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: true,
            isClientReady: true,
        });

        const { container } = render(<ButtonShare />);
        expect(container.querySelector("button")).not.toBeInTheDocument();
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

    it("should call openSharingPage on click by default", async () => {
        render(<ButtonShare />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        await waitFor(() => {
            expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
                undefined,
                undefined
            );
        });
    });

    it("should call openEmbeddedWallet when clickAction is embedded-wallet", async () => {
        render(<ButtonShare clickAction="embedded-wallet" />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        await waitFor(() => {
            expect(embeddedWalletUtils.openEmbeddedWallet).toHaveBeenCalledWith(
                undefined,
                undefined
            );
        });
    });

    it("should call handleShare when clickAction is share-modal", async () => {
        const mockHandleShare = vi.fn().mockResolvedValue(undefined);
        vi.mocked(useShareModalHook.useShareModal).mockReturnValue({
            handleShare: mockHandleShare,
            isError: false,
            debugInfo: undefined,
        });

        render(<ButtonShare clickAction="share-modal" />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        await waitFor(() => {
            expect(mockHandleShare).toHaveBeenCalledTimes(1);
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
            <ButtonShare useReward targetInteraction="custom.customerMeeting" />
        );

        expect(useRewardHook.useReward).toHaveBeenCalledWith(
            true,
            "custom.customerMeeting"
        );
    });

    it("should pass targetInteraction to useShareModal hook", () => {
        render(<ButtonShare targetInteraction="custom.customerMeeting" />);

        expect(useShareModalHook.useShareModal).toHaveBeenCalledWith(
            "custom.customerMeeting",
            undefined
        );
    });
});
