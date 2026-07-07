/// <reference types="@testing-library/jest-dom" />
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TextArea } from ".";

describe("TextArea", () => {
    it("should render a textarea element inside a span wrapper", () => {
        const { container } = render(<TextArea aria-label="test" />);
        const wrapper = container.querySelector("span");
        const textarea = container.querySelector("textarea");
        expect(wrapper).toBeTruthy();
        expect(textarea).toBeTruthy();
    });

    it("should forward native textarea props", () => {
        render(<TextArea placeholder="Enter message" aria-label="msg" />);
        const textarea = screen.getByPlaceholderText("Enter message");
        expect(textarea).toBeInTheDocument();
    });

    it("should render all 3 length variants", () => {
        const lengths = ["small", "medium", "big"] as const;
        for (const length of lengths) {
            const { container } = render(
                <TextArea length={length} aria-label={length} />
            );
            expect(container.querySelector("span")).toBeTruthy();
        }
    });

    it("should apply error styling", () => {
        const { container } = render(<TextArea error aria-label="error" />);
        const wrapper = container.querySelector("span");
        expect(wrapper).toBeTruthy();
        expect(wrapper?.className).toBeTruthy();
    });

    it("should set disabled on the textarea", () => {
        render(<TextArea disabled aria-label="disabled" />);
        expect(screen.getByLabelText("disabled")).toBeDisabled();
    });

    it("should forward className to wrapper", () => {
        const { container } = render(
            <TextArea className="custom" aria-label="cls" />
        );
        const wrapper = container.querySelector("span");
        expect(wrapper?.className).toContain("custom");
    });

    it("should forward rows prop", () => {
        render(<TextArea rows={5} aria-label="rows" />);
        expect(screen.getByLabelText("rows")).toHaveAttribute("rows", "5");
    });

    it("should render no label/hint nodes and unchanged DOM when neither is set", () => {
        const { container } = render(<TextArea aria-label="plain" />);
        expect(container.querySelector("label")).toBeNull();
        expect(container.querySelectorAll("span").length).toBe(1);
        const textarea = container.querySelector("textarea");
        expect(textarea).toBeTruthy();
        expect(textarea?.id).toBe("");
    });

    it("should render a label associated to the control via htmlFor/id", () => {
        render(<TextArea label="Message" />);
        const textarea = screen.getByLabelText("Message");
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("should focus the control when the label is clicked", async () => {
        const user = userEvent.setup();
        render(<TextArea label="Message" />);
        const label = screen.getByText("Message");
        await user.click(label);
        expect(screen.getByLabelText("Message")).toHaveFocus();
    });

    it("should preserve a caller-supplied id and match it in htmlFor", () => {
        const { container } = render(
            <TextArea label="Message" id="custom-id" />
        );
        const textarea = container.querySelector("textarea");
        const label = container.querySelector("label");
        expect(textarea?.id).toBe("custom-id");
        expect(label?.getAttribute("for")).toBe("custom-id");
    });

    it("should generate an id when label is set and no id is passed", () => {
        const { container } = render(<TextArea label="Message" />);
        const textarea = container.querySelector("textarea");
        const label = container.querySelector("label");
        expect(textarea?.id).toBeTruthy();
        expect(textarea?.id).toBe(label?.getAttribute("for"));
    });

    it("should render a hint", () => {
        render(<TextArea aria-label="with-hint" hint="Max 500 characters" />);
        expect(screen.getByText("Max 500 characters")).toBeInTheDocument();
    });

    it("should render hint without a label and without wiring an id", () => {
        const { container } = render(
            <TextArea aria-label="hint-only" hint="Just a hint" />
        );
        expect(container.querySelector("label")).toBeNull();
        expect(screen.getByText("Just a hint")).toBeInTheDocument();
        const textarea = container.querySelector("textarea");
        expect(textarea?.id).toBe("");
    });

    it("should link the hint to the control via aria-describedby", () => {
        render(<TextArea label="Message" hint="Max 500 characters" />);
        expect(screen.getByLabelText("Message")).toHaveAccessibleDescription(
            "Max 500 characters"
        );
    });

    it("should merge a caller-supplied aria-describedby with the hint", () => {
        render(
            <>
                <span id="external">External note</span>
                <TextArea
                    label="Message"
                    hint="Hint text"
                    aria-describedby="external"
                />
            </>
        );
        const textarea = screen.getByLabelText("Message");
        expect(textarea.getAttribute("aria-describedby")).toContain("external");
        expect(textarea).toHaveAccessibleDescription("External note Hint text");
    });

    // FRA-246/U4 — simulate what react-hook-form's Radix `FormControl` Slot
    // injects onto its child: id, aria-invalid, aria-describedby.
    it("should forward FormControl-style id/aria-invalid/aria-describedby to the control", () => {
        const { container } = render(
            <TextArea
                label="Message"
                id="x-form-item"
                aria-invalid="true"
                aria-describedby="x-msg"
            />
        );
        const textarea = container.querySelector("textarea");
        const label = container.querySelector("label");
        expect(textarea?.id).toBe("x-form-item");
        expect(textarea?.getAttribute("aria-invalid")).toBe("true");
        expect(textarea?.getAttribute("aria-describedby")).toContain("x-msg");
        expect(label?.getAttribute("for")).toBe("x-form-item");
    });

    it("should merge a FormControl aria-describedby with the hint id (caller value first)", () => {
        render(
            <TextArea
                label="Message"
                hint="Max 500 characters"
                id="x-form-item"
                aria-invalid="true"
                aria-describedby="x-msg"
            />
        );
        const textarea = screen.getByLabelText("Message");
        expect(textarea.getAttribute("aria-describedby")).toBe(
            "x-msg x-form-item-hint"
        );
        expect(textarea).toHaveAccessibleDescription("Max 500 characters");
    });

    it("should apply field-box error styling in labeled mode (differs from neutral)", () => {
        const { container: withError } = render(
            <TextArea label="Message" error aria-label="with-error" />
        );
        const { container: withoutError } = render(
            <TextArea label="Message" aria-label="without-error" />
        );
        const errorWrapperClass = withError.querySelector("span")?.className;
        const plainWrapperClass = withoutError.querySelector("span")?.className;
        expect(errorWrapperClass).toBeTruthy();
        expect(errorWrapperClass).not.toBe(plainWrapperClass);
    });

    it("should keep label/hint classes identical under error (no tint)", () => {
        const errored = render(
            <TextArea label="Message" hint="Max 500 characters" error />
        );
        const neutral = render(
            <TextArea label="Message" hint="Max 500 characters" />
        );
        // The label + hint must be byte-identical with and without `error` —
        // this fails the moment any error tint class is added to them.
        expect(errored.container.querySelector("label")?.className).toBe(
            neutral.container.querySelector("label")?.className
        );
        expect(
            within(errored.container).getByText("Max 500 characters").className
        ).toBe(
            within(neutral.container).getByText("Max 500 characters").className
        );
    });

    // Field spec: 8px label→control, 4px control→hint. Encoded by nesting
    // the control + hint in an inner Stack that is a sibling of the label, so
    // the label keeps the wider outer gap. Locks the structure against a
    // regression back to a single flat 4px stack.
    it("nests control+hint under the label (8/4 spacing structure)", () => {
        const { container } = render(
            <TextArea label="Message" hint="Max 500 characters" />
        );
        const labelEl = container.querySelector("label");
        const textarea = container.querySelector("textarea");
        const hint = screen.getByText("Max 500 characters");
        const outer = labelEl?.parentElement;
        const inner = hint.parentElement;
        expect(outer).not.toBe(inner);
        expect(outer).toContainElement(inner);
        expect(inner).toContainElement(textarea);
    });
});
