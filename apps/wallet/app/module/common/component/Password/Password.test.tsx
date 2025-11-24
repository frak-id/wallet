import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Password } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("Password", () => {
    const mockOnSubmit = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render password input", () => {
        render(<Password onSubmit={mockOnSubmit} />);

        const input = screen.getByLabelText(/wallet.password.enter/i);
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("type", "password");
    });

    it("should render submit button", () => {
        render(<Password onSubmit={mockOnSubmit} />);

        const submitButton = screen.getByRole("button", {
            name: /common.submit/i,
        });
        expect(submitButton).toBeInTheDocument();
        expect(submitButton).toHaveAttribute("type", "submit");
    });

    it("should call onSubmit with password when form is submitted", async () => {
        render(<Password onSubmit={mockOnSubmit} />);

        const input = screen.getByLabelText(/wallet.password.enter/i);
        const submitButton = screen.getByRole("button", {
            name: /common.submit/i,
        });

        fireEvent.change(input, { target: { value: "testpassword123" } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                { password: "testpassword123" },
                expect.any(Object)
            );
        });
    });

    it("should show error when password is too short", async () => {
        render(<Password onSubmit={mockOnSubmit} />);

        const input = screen.getByLabelText(/wallet.password.enter/i);
        const submitButton = screen.getByRole("button", {
            name: /common.submit/i,
        });

        fireEvent.change(input, { target: { value: "123" } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(
                screen.getByText(/wallet.password.minimum/i)
            ).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should show error when password is empty", async () => {
        render(<Password onSubmit={mockOnSubmit} />);

        const submitButton = screen.getByRole("button", {
            name: /common.submit/i,
        });

        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(
                screen.getByText(/wallet.password.required/i)
            ).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should mark input as invalid when there are errors", async () => {
        render(<Password onSubmit={mockOnSubmit} />);

        const input = screen.getByLabelText(/wallet.password.enter/i);
        const submitButton = screen.getByRole("button", {
            name: /common.submit/i,
        });

        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(input).toHaveAttribute("aria-invalid", "true");
        });
    });
});
