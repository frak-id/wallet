import * as coreSdk from "@frak-labs/core-sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embeddedWalletUtils from "@/actions/embeddedWallet";
import * as sharingPageUtils from "@/actions/sharingPage";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as useRewardHook from "@/hooks/useReward";
import { ButtonShare } from "./ButtonShare";

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

vi.mock("@/actions/embeddedWallet", () => ({
    openEmbeddedWallet: vi.fn(),
}));

vi.mock("@/actions/sharingPage", () => ({
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

    it("should substitute {REWARD} placeholder when reward is available", () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: "10 eur",
        });

        render(<ButtonShare text="Earn up to {REWARD}!" />);
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Earn up to 10 eur!");
    });

    it("should use noRewardText when {REWARD} placeholder is present but no reward is available", () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: undefined,
        });

        render(
            <ButtonShare
                text="Earn up to {REWARD}!"
                noRewardText="Share and earn!"
            />
        );
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Share and earn!");
    });

    it("should strip {REWARD} placeholder when no reward and no noRewardText", () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: undefined,
        });

        render(<ButtonShare text="Earn up to {REWARD}!" />);
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Earn up to !");
    });

    it("should not fetch reward when text has no {REWARD} placeholder", () => {
        render(<ButtonShare text="Share and earn!" />);
        const button = screen.getByRole("button");
        expect(button).toHaveTextContent("Share and earn!");
        expect(useRewardHook.useReward).toHaveBeenCalledWith(false, undefined);
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

    it("should route legacy share-modal clickAction to openSharingPage", async () => {
        // The `share-modal` value was retired in favour of `displaySharingPage`;
        // existing merchant configs still ship with that string so the
        // component must gracefully fall through to the sharing-page UI.
        render(
            <ButtonShare
                // string value that is no longer in the typed union.
                clickAction={"share-modal" as any}
            />
        );
        const button = screen.getByRole("button");

        fireEvent.click(button);

        await waitFor(() => {
            expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
                undefined,
                undefined
            );
        });
        expect(embeddedWalletUtils.openEmbeddedWallet).not.toHaveBeenCalled();
    });

    it("should track event on click", () => {
        render(<ButtonShare />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        expect(coreSdk.trackEvent).toHaveBeenCalledWith(
            window.FrakSetup.client,
            "share_button_clicked",
            expect.objectContaining({
                click_action: "sharing-page",
                has_reward: false,
            })
        );
    });

    it("should pass targetInteraction to useReward hook when {REWARD} placeholder is present", () => {
        render(
            <ButtonShare
                text="Earn up to {REWARD}!"
                targetInteraction="custom.customerMeeting"
            />
        );

        expect(useRewardHook.useReward).toHaveBeenCalledWith(
            true,
            "custom.customerMeeting"
        );
    });

    it("should forward targetInteraction to openSharingPage", async () => {
        render(<ButtonShare targetInteraction="custom.customerMeeting" />);
        const button = screen.getByRole("button");

        fireEvent.click(button);

        await waitFor(() => {
            expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
                "custom.customerMeeting",
                undefined
            );
        });
    });
});
