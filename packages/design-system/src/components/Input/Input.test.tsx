/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from ".";

describe("Input", () => {
    it("should render an input element inside a span wrapper", () => {
        const { container } = render(<Input aria-label="test" />);
        const wrapper = container.querySelector("span");
        const input = container.querySelector("input");
        expect(wrapper).toBeTruthy();
        expect(input).toBeTruthy();
    });

    it("should forward native input props", () => {
        render(
            <Input placeholder="Enter email" type="email" aria-label="email" />
        );
        const input = screen.getByPlaceholderText("Enter email");
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("type", "email");
    });

    it("should render all 3 length variants", () => {
        const lengths = ["small", "medium", "big"] as const;
        for (const length of lengths) {
            const { container } = render(
                <Input length={length} aria-label={length} />
            );
            expect(container.querySelector("span")).toBeTruthy();
        }
    });

    it("should apply error styling", () => {
        const { container } = render(<Input error aria-label="error" />);
        const wrapper = container.querySelector("span");
        expect(wrapper).toBeTruthy();
        expect(wrapper?.className).toBeTruthy();
    });

    it("should render leftSection", () => {
        render(
            <Input
                leftSection={<span data-testid="left">$</span>}
                aria-label="price"
            />
        );
        expect(screen.getByTestId("left")).toBeInTheDocument();
    });

    it("should render rightSection", () => {
        render(
            <Input
                rightSection={<span data-testid="right">USD</span>}
                aria-label="price"
            />
        );
        expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("should set disabled on the input", () => {
        render(<Input disabled aria-label="disabled" />);
        expect(screen.getByLabelText("disabled")).toBeDisabled();
    });

    it("should forward className to wrapper", () => {
        const { container } = render(
            <Input className="custom" aria-label="cls" />
        );
        const wrapper = container.querySelector("span");
        expect(wrapper?.className).toContain("custom");
    });

    it("should render the soft variant", () => {
        const { container } = render(
            <Input
                variant="soft"
                placeholder="Search"
                aria-label="search"
                leftSection={<span data-testid="left">i</span>}
            />
        );
        const wrapper = container.querySelector("span");
        expect(wrapper).toBeTruthy();
        expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
        expect(screen.getByTestId("left")).toBeInTheDocument();
    });

    it("should render no label/hint nodes and unchanged DOM when neither is set", () => {
        const { container } = render(<Input aria-label="plain" />);
        expect(container.querySelector("label")).toBeNull();
        expect(container.querySelectorAll("span").length).toBe(1);
        const input = container.querySelector("input");
        expect(input).toBeTruthy();
        expect(input?.id).toBe("");
    });

    it("should render a label associated to the control via htmlFor/id", () => {
        render(<Input label="Email" />);
        const input = screen.getByLabelText("Email");
        expect(input).toBeInTheDocument();
        expect(input.tagName).toBe("INPUT");
    });

    it("should focus the control when the label is clicked", async () => {
        const user = userEvent.setup();
        render(<Input label="Email" />);
        const label = screen.getByText("Email");
        await user.click(label);
        expect(screen.getByLabelText("Email")).toHaveFocus();
    });

    it("should preserve a caller-supplied id and match it in htmlFor", () => {
        const { container } = render(<Input label="Email" id="custom-id" />);
        const input = container.querySelector("input");
        const label = container.querySelector("label");
        expect(input?.id).toBe("custom-id");
        expect(label?.getAttribute("for")).toBe("custom-id");
    });

    it("should generate an id when label is set and no id is passed", () => {
        const { container } = render(<Input label="Email" />);
        const input = container.querySelector("input");
        const label = container.querySelector("label");
        expect(input?.id).toBeTruthy();
        expect(input?.id).toBe(label?.getAttribute("for"));
    });

    it("should render a hint", () => {
        render(
            <Input aria-label="with-hint" hint="We never share your email" />
        );
        expect(
            screen.getByText("We never share your email")
        ).toBeInTheDocument();
    });

    it("should render hint without a label and without wiring an id", () => {
        const { container } = render(
            <Input aria-label="hint-only" hint="Just a hint" />
        );
        expect(container.querySelector("label")).toBeNull();
        expect(screen.getByText("Just a hint")).toBeInTheDocument();
        const input = container.querySelector("input");
        expect(input?.id).toBe("");
    });

    it("should link the hint to the control via aria-describedby", () => {
        render(<Input label="Email" hint="We never share your email" />);
        expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
            "We never share your email"
        );
    });

    it("should merge a caller-supplied aria-describedby with the hint", () => {
        render(
            <>
                <span id="external">External note</span>
                <Input
                    label="Email"
                    hint="Hint text"
                    aria-describedby="external"
                />
            </>
        );
        const input = screen.getByLabelText("Email");
        expect(input.getAttribute("aria-describedby")).toContain("external");
        expect(input).toHaveAccessibleDescription("External note Hint text");
    });
});
