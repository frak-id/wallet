import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionHash, WalletAddress } from "./index";

// Mock the copy hook
const mockCopy = vi.fn();
vi.mock("../../hook/useCopyToClipboardWithState", () => ({
    useCopyToClipboardWithState: () => ({
        copied: false,
        copy: mockCopy,
    }),
}));

describe("HashDisplay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("WalletAddress", () => {
        it("should render wallet address in shortened format", () => {
            const wallet =
                "0x1234567890123456789012345678901234567890" as const;
            render(<WalletAddress wallet={wallet} />);

            // Should show shortened format: 0x12...890
            expect(screen.getByRole("button")).toBeInTheDocument();
            expect(screen.getByRole("button").textContent).toContain("...");
        });

        it("should not render when wallet is empty", () => {
            const { container } = render(<WalletAddress wallet={"" as any} />);
            expect(container.firstChild).toBeNull();
        });

        it("should call copy when clicked", () => {
            const wallet =
                "0x1234567890123456789012345678901234567890" as const;
            render(<WalletAddress wallet={wallet} />);

            const button = screen.getByRole("button");
            fireEvent.click(button);

            expect(mockCopy).toHaveBeenCalledWith(wallet);
        });

        it("should render with custom copied text prop", () => {
            const wallet =
                "0x1234567890123456789012345678901234567890" as const;
            render(<WalletAddress wallet={wallet} copiedText="Copied!" />);

            const button = screen.getByRole("button");
            expect(button).toBeInTheDocument();
            // copiedText is used when copied state is true (handled by hook)
        });
    });

    describe("TransactionHash", () => {
        it("should render transaction hash in shortened format", () => {
            const hash =
                "0x1234567890123456789012345678901234567890123456789012345678901234" as const;
            render(<TransactionHash hash={hash} />);

            // Should show shortened format: 0x1234...1234
            expect(screen.getByRole("button")).toBeInTheDocument();
            expect(screen.getByRole("button").textContent).toContain("...");
        });

        it("should not render when hash is empty", () => {
            const { container } = render(<TransactionHash hash={"" as any} />);
            expect(container.firstChild).toBeNull();
        });

        it("should call copy when clicked", () => {
            const hash =
                "0x1234567890123456789012345678901234567890123456789012345678901234" as const;
            render(<TransactionHash hash={hash} />);

            const button = screen.getByRole("button");
            fireEvent.click(button);

            expect(mockCopy).toHaveBeenCalledWith(hash);
        });

        it("should show custom copied text", () => {
            const hash =
                "0x1234567890123456789012345678901234567890123456789012345678901234" as const;
            render(<TransactionHash hash={hash} copiedText="Hash copied!" />);

            const button = screen.getByRole("button");
            expect(button).toBeInTheDocument();
        });
    });
});
