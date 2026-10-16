import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { LabelledInput } from "./index";

describe("LabelledInput", () => {
    test("the label names the input", () => {
        render(<LabelledInput label="Note" defaultValue="" />);
        expect(screen.getByLabelText("Note")).toBeTruthy();
    });

    test("an error is announced and described by the input", () => {
        render(<LabelledInput label="Note" errorMessage="Too short" />);

        const alert = screen.getByRole("alert");
        const input = screen.getByLabelText("Note");
        expect(alert.textContent).toBe("Too short");
        expect(input.getAttribute("aria-describedby")).toBe(alert.id);
        expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    test("without an error the input is not described by anything", () => {
        render(<LabelledInput label="Note" />);

        const input = screen.getByLabelText("Note");
        expect(input.hasAttribute("aria-describedby")).toBe(false);
        expect(input.getAttribute("aria-invalid")).toBe("false");
    });
});
