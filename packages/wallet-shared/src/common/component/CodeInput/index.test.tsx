/**
 * Tests for CodeInput — the single-overlay-input OTP component.
 * Covers sanitization (numeric vs alphanumeric), multi-char paste/autofill,
 * length capping, defaultValue seeding, read-only rendering + a11y exposure,
 * and the clipboard paste button.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeInput } from "./index";

// Force the web clipboard path (avoid the dynamic Tauri import branch).
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    IS_TAURI: false,
}));

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const LABEL = "Verification code";

function renderEditable(props: Record<string, unknown> = {}) {
    const onChange = vi.fn();
    render(<CodeInput label={LABEL} onChange={onChange} {...props} />);
    const input = screen.getByLabelText(LABEL) as HTMLInputElement;
    return { input, onChange };
}

describe("CodeInput — editable", () => {
    it("strips non-digits in numeric mode", () => {
        const { input, onChange } = renderEditable();
        fireEvent.change(input, { target: { value: "12a3" } });
        expect(input.value).toBe("123");
        expect(onChange).toHaveBeenLastCalledWith("123");
    });

    it("uppercases and strips symbols in alphanumeric mode", () => {
        const { input } = renderEditable({ mode: "alphanumeric" });
        fireEvent.change(input, { target: { value: "a1-b2" } });
        expect(input.value).toBe("A1B2");
    });

    it("caps the value at the configured length (autofill/paste)", () => {
        const { input, onChange } = renderEditable({ length: 6 });
        fireEvent.change(input, { target: { value: "1234567890" } });
        expect(input.value).toBe("123456");
        expect(onChange).toHaveBeenLastCalledWith("123456");
    });

    it("seeds the input from defaultValue", () => {
        const onChange = vi.fn();
        render(
            <CodeInput label={LABEL} defaultValue="42" onChange={onChange} />
        );
        expect(screen.getByLabelText(LABEL)).toHaveValue("42");
        expect(onChange).toHaveBeenCalledWith("42");
    });

    it("renders the error message", () => {
        render(<CodeInput label={LABEL} error="Bad code" />);
        expect(screen.getByText("Bad code")).toBeInTheDocument();
    });

    it("enables OS autofill via autocomplete='one-time-code'", () => {
        const { input } = renderEditable();
        expect(input).toHaveAttribute("autocomplete", "one-time-code");
        expect(input).toHaveAttribute("autocorrect", "off");
    });
});

describe("CodeInput — clipboard paste button", () => {
    it("fills the code from the clipboard", async () => {
        const readText = vi.fn().mockResolvedValue("987654");
        Object.assign(navigator, { clipboard: { readText } });

        render(<CodeInput label={LABEL} pasteLabel="Paste" />);
        fireEvent.click(screen.getByRole("button", { name: "Paste" }));

        expect(await screen.findByDisplayValue("987654")).toBeInTheDocument();
    });

    it("surfaces the paste error label when the clipboard read fails", async () => {
        const readText = vi.fn().mockRejectedValue(new Error("denied"));
        Object.assign(navigator, { clipboard: { readText } });

        render(
            <CodeInput
                label={LABEL}
                pasteLabel="Paste"
                pasteErrorLabel="Clipboard blocked"
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Paste" }));

        expect(
            await screen.findByText("Clipboard blocked")
        ).toBeInTheDocument();
    });
});

describe("CodeInput — read-only", () => {
    it("renders no editable input", () => {
        render(<CodeInput value="135" />);
        expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("exposes the code to screen readers as spaced characters", () => {
        render(<CodeInput value="135" />);
        expect(screen.getByText("1 3 5")).toBeInTheDocument();
    });

    it("sanitizes the displayed value by mode", () => {
        render(<CodeInput value="ab" mode="alphanumeric" />);
        expect(screen.getByText("A B")).toBeInTheDocument();
    });
});
