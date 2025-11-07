import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useCopyToClipboardHook from "@/hooks/useCopyToClipboard";
import { ErrorMessage } from "./ErrorMessage";

// Mock useCopyToClipboard hook
vi.mock("@/hooks/useCopyToClipboard", () => ({
    useCopyToClipboard: vi.fn(() => ({
        copied: false,
        copy: vi.fn(),
    })),
}));

describe("ErrorMessage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render error message", () => {
        render(<ErrorMessage debugInfo="Test debug info" />);
        expect(
            screen.getByText(/Oups ! Nous avons rencontré/)
        ).toBeInTheDocument();
    });

    it("should render copy button", () => {
        render(<ErrorMessage debugInfo="Test debug info" />);
        expect(
            screen.getByText("Copier les informations de débogage")
        ).toBeInTheDocument();
    });

    it("should call copy function when copy button is clicked", () => {
        const mockCopy = vi.fn();
        vi.mocked(useCopyToClipboardHook.useCopyToClipboard).mockReturnValue({
            copied: false,
            copy: mockCopy,
        });

        render(<ErrorMessage debugInfo="Test debug info" />);
        const copyButton = screen.getByText(
            "Copier les informations de débogage"
        );

        fireEvent.click(copyButton);

        expect(mockCopy).toHaveBeenCalledWith("Test debug info");
    });

    it("should call copy with empty string when debugInfo is undefined", () => {
        const mockCopy = vi.fn();
        vi.mocked(useCopyToClipboardHook.useCopyToClipboard).mockReturnValue({
            copied: false,
            copy: mockCopy,
        });

        render(<ErrorMessage />);
        const copyButton = screen.getByText(
            "Copier les informations de débogage"
        );

        fireEvent.click(copyButton);

        expect(mockCopy).toHaveBeenCalledWith("");
    });

    it("should display copied state when copy is successful", () => {
        vi.mocked(useCopyToClipboardHook.useCopyToClipboard).mockReturnValue({
            copied: true,
            copy: vi.fn(),
        });

        render(<ErrorMessage debugInfo="Test debug info" />);
        expect(screen.getByText("Informations copiées !")).toBeInTheDocument();
    });

    it("should toggle debug info visibility", async () => {
        render(<ErrorMessage debugInfo="Test debug info" />);
        const toggleButton = screen.getByText("Ouvrir les informations");

        // Initially, textarea should not be visible
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

        // Click to show
        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(screen.getByRole("textbox")).toBeInTheDocument();
        });

        // Click again to hide
        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        });
    });

    it("should display debug info in textarea when toggled", async () => {
        render(<ErrorMessage debugInfo="Test debug info" />);
        const toggleButton = screen.getByText("Ouvrir les informations");

        fireEvent.click(toggleButton);

        await waitFor(() => {
            const textarea = screen.getByRole("textbox");
            expect(textarea).toHaveValue("Test debug info");
        });
    });
});
