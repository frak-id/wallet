import * as walletSharedModule from "@frak-labs/wallet-shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "wagmi";
import { ToggleSession } from "./index";

vi.mock("@frak-labs/wallet-shared", () => ({
    useInteractionSessionStatus: vi.fn(),
    useOpenSession: vi.fn(),
    useCloseSession: vi.fn(),
}));

vi.mock("wagmi", () => ({
    useAccount: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("ToggleSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should not render when session status is pending", () => {
        vi.mocked(useAccount).mockReturnValue({
            address: "0x123" as `0x${string}`,
        } as any);

        vi.mocked(
            walletSharedModule.useInteractionSessionStatus
        ).mockReturnValue({
            data: null,
            isPending: true,
        } as any);

        vi.mocked(walletSharedModule.useOpenSession).mockReturnValue({
            mutate: vi.fn(),
            mutateAsync: vi.fn(),
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useCloseSession).mockReturnValue({
            mutate: vi.fn(),
            mutateAsync: vi.fn(),
            isPending: false,
        } as any);

        const { container } = render(<ToggleSession />);
        expect(container.firstChild).toBeNull();
    });

    it("should render switch when session is inactive", () => {
        vi.mocked(useAccount).mockReturnValue({
            address: "0x123" as `0x${string}`,
        } as any);

        vi.mocked(
            walletSharedModule.useInteractionSessionStatus
        ).mockReturnValue({
            data: null,
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useOpenSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useCloseSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as any);

        render(<ToggleSession />);

        const switchElement = screen.getByRole("switch");
        expect(switchElement).toBeInTheDocument();
        expect(switchElement).not.toBeChecked();
    });

    it("should render switch when session is active", () => {
        vi.mocked(useAccount).mockReturnValue({
            address: "0x123" as `0x${string}`,
        } as any);

        const mockSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        vi.mocked(
            walletSharedModule.useInteractionSessionStatus
        ).mockReturnValue({
            data: mockSession,
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useOpenSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useCloseSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as any);

        render(<ToggleSession />);

        const switchElement = screen.getByRole("switch");
        expect(switchElement).toBeInTheDocument();
        expect(switchElement).toBeChecked();
    });

    it("should show spinner when opening session", () => {
        vi.mocked(useAccount).mockReturnValue({
            address: "0x123" as `0x${string}`,
        } as any);

        vi.mocked(
            walletSharedModule.useInteractionSessionStatus
        ).mockReturnValue({
            data: null,
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useOpenSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: true,
        } as any);

        vi.mocked(walletSharedModule.useCloseSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as any);

        render(<ToggleSession />);

        // Spinner should be rendered
        const spinner = document.querySelector('[class*="spinner"]');
        expect(spinner).toBeInTheDocument();
    });

    it("should show spinner when closing session", () => {
        vi.mocked(useAccount).mockReturnValue({
            address: "0x123" as `0x${string}`,
        } as any);

        const mockSession = {
            sessionStart: Date.now(),
            sessionEnd: Date.now() + 3600000,
        };

        vi.mocked(
            walletSharedModule.useInteractionSessionStatus
        ).mockReturnValue({
            data: mockSession,
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useOpenSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as any);

        vi.mocked(walletSharedModule.useCloseSession).mockReturnValue({
            mutate: vi.fn(),
            isPending: true,
        } as any);

        render(<ToggleSession />);

        // Spinner should be rendered
        const spinner = document.querySelector('[class*="spinner"]');
        expect(spinner).toBeInTheDocument();
    });
});
