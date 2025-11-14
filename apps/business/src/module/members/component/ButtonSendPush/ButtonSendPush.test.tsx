import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ButtonSendPush } from "./index";

const mockNavigate = vi.fn();
const mockSetForm = vi.fn();

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@/stores/pushCreationStore", () => ({
    pushCreationStore: vi.fn((selector) =>
        selector({
            setForm: mockSetForm,
        })
    ),
}));

vi.mock("lucide-react", () => ({
    Plus: ({ size }: { size: number }) => (
        <span data-testid="plus-icon" data-size={size}>
            +
        </span>
    ),
}));

describe("ButtonSendPush", () => {
    it("should render button with 'Send Push' text", () => {
        render(<ButtonSendPush />);

        expect(screen.getByText("Send Push")).toBeInTheDocument();
    });

    it("should render with Plus icon (size 20) on left", () => {
        render(<ButtonSendPush />);

        const icon = screen.getByTestId("plus-icon");
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute("data-size", "20");
    });

    it("should call setForm(undefined) and navigate when clicked", () => {
        render(<ButtonSendPush />);

        const button = screen.getByText("Send Push");
        fireEvent.click(button);

        expect(mockSetForm).toHaveBeenCalledWith(undefined);
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/push/create" });
    });
});
