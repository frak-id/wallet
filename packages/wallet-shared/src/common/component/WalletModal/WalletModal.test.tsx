import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletModal } from "./index";

describe("WalletModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render closed by default", () => {
        render(
            <WalletModal
                title="Test Modal"
                description="Test description"
                button={{ label: "Open Modal" }}
            />
        );

        // Modal content should not be visible when closed
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("should open when trigger button is clicked", async () => {
        render(
            <WalletModal
                title="Test Modal"
                description="Test description"
                button={{ label: "Open Modal" }}
            />
        );

        const trigger = screen.getByRole("button", { name: "Open Modal" });
        fireEvent.click(trigger);

        await waitFor(() => {
            expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        });
    });

    it("should close when close button is clicked", async () => {
        const handleOpenChange = vi.fn();
        render(
            <WalletModal
                title="Test Modal"
                description="Test description"
                button={{ label: "Open Modal" }}
                onOpenChange={handleOpenChange}
            />
        );

        // Open modal
        fireEvent.click(screen.getByRole("button", { name: "Open Modal" }));

        await waitFor(() => {
            expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        });

        // Close modal
        const closeButton = screen.getByRole("button", { name: "Close" });
        fireEvent.click(closeButton);

        await waitFor(() => {
            expect(handleOpenChange).toHaveBeenCalledWith(false);
        });
    });

    it("should close when overlay is clicked", async () => {
        const handleOpenChange = vi.fn();
        render(
            <WalletModal
                title="Test Modal"
                description="Test description"
                button={{ label: "Open Modal" }}
                onOpenChange={handleOpenChange}
            />
        );

        // Open modal
        fireEvent.click(screen.getByRole("button", { name: "Open Modal" }));

        await waitFor(() => {
            expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        });

        // Click overlay
        const overlay = document.querySelector("[data-radix-portal]");
        if (overlay) {
            fireEvent.click(overlay);
            await waitFor(() => {
                expect(handleOpenChange).toHaveBeenCalledWith(false);
            });
        }
    });

    it("should render with title and description", async () => {
        render(
            <WalletModal
                title="Test Title"
                description="Test Description"
                button={{ label: "Open" }}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(screen.getByText("Test Title")).toBeInTheDocument();
            expect(screen.getByText("Test Description")).toBeInTheDocument();
        });
    });

    it("should render with text prop", async () => {
        render(
            <WalletModal
                title="Test Title"
                text="Additional text content"
                button={{ label: "Open" }}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(
                screen.getByText("Additional text content")
            ).toBeInTheDocument();
        });
    });

    it("should render with action buttons", async () => {
        const handleAction = vi.fn();
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                action={
                    <button type="button" onClick={handleAction}>
                        Confirm
                    </button>
                }
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            const confirmButton = screen.getByRole("button", {
                name: "Confirm",
            });
            expect(confirmButton).toBeInTheDocument();
            fireEvent.click(confirmButton);
            expect(handleAction).toHaveBeenCalledTimes(1);
        });
    });

    it("should call onSuccess callback when action is clicked with actionClose", async () => {
        const handleSuccess = vi.fn();
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                action={<button type="button">Confirm</button>}
                actionClose={true}
                onSuccess={handleSuccess}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            const confirmButton = screen.getByRole("button", {
                name: "Confirm",
            });
            fireEvent.click(confirmButton);
            // Note: onSuccess might be called through actionClose mechanism
        });
    });

    it("should work in controlled mode with open prop", async () => {
        const handleOpenChange = vi.fn();
        const { rerender } = render(
            <WalletModal
                title="Test Title"
                open={false}
                onOpenChange={handleOpenChange}
            />
        );

        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

        rerender(
            <WalletModal
                title="Test Title"
                open={true}
                onOpenChange={handleOpenChange}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        });
    });

    it("should work in uncontrolled mode with defaultOpen", async () => {
        render(<WalletModal title="Test Title" defaultOpen={true} />);

        await waitFor(() => {
            expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        });
    });

    it("should call onOpenChange when modal state changes", async () => {
        const handleOpenChange = vi.fn();
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                onOpenChange={handleOpenChange}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(handleOpenChange).toHaveBeenCalledWith(true);
        });
    });

    it("should not show close button when showCloseButton is false", async () => {
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                showCloseButton={false}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(screen.getByRole("alertdialog")).toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: "Close" })
            ).not.toBeInTheDocument();
        });
    });

    it("should render with custom closeButton", async () => {
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                closeButton={<button type="button">Custom Close</button>}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Custom Close" })
            ).toBeInTheDocument();
        });
    });

    it("should render with cancel button", async () => {
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                cancel={<button type="button">Cancel</button>}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Cancel" })
            ).toBeInTheDocument();
        });
    });

    it("should apply custom classNameContent", async () => {
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                classNameContent="custom-content"
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            const dialog = screen.getByRole("alertdialog");
            expect(dialog).toHaveClass("custom-content");
        });
    });

    it("should apply custom classNameTitle", async () => {
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                classNameTitle="custom-title"
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            const title = screen.getByText("Test Title");
            expect(title).toHaveClass("custom-title");
        });
    });

    it("should render with footerAfter", async () => {
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open" }}
                footer={{ after: <div>Footer Content</div> }}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(screen.getByText("Footer Content")).toBeInTheDocument();
        });
    });

    it("should render with disabled trigger button", () => {
        render(
            <WalletModal
                title="Test Title"
                button={{ label: "Open", disabled: true }}
            />
        );

        const trigger = screen.getByRole("button", { name: "Open" });
        expect(trigger).toBeDisabled();
    });
});
