import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: { label?: string }) =>
            options?.label ? `${key}:${options.label}` : key,
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

import { useForm } from "react-hook-form";
import { Form } from "@/module/forms/Form";
import { serializeStyleCss, TRANSPARENT } from "../style/styleCodec";
import type {
    ButtonShareStyleFormValues,
    ButtonShareStyleValues,
    ComponentSettingsFormValues,
} from "../types";
import { ButtonShareStyleFields } from "./ButtonShareStyleFields";

const emptyText = { default: "", en: "", fr: "" };

let currentForm: { getValues: () => ComponentSettingsFormValues } | undefined;

function Harness({
    tier,
    style,
}: {
    tier: string;
    style: ButtonShareStyleValues;
}) {
    const form = useForm<ComponentSettingsFormValues>({
        defaultValues: {
            targetInteraction: "",
            buttonShare: {
                text: emptyText,
                noRewardText: emptyText,
                style,
                foreignCss: "",
            },
        } as ComponentSettingsFormValues,
    });
    currentForm = form;
    return (
        <Form {...form}>
            <ButtonShareStyleFields form={form} tier={tier} />
        </Form>
    );
}

function SyncHarness({ style }: { style: ButtonShareStyleValues }) {
    const form = useForm<ComponentSettingsFormValues>({
        values: {
            targetInteraction: "",
            buttonShare: {
                text: emptyText,
                noRewardText: emptyText,
                style,
                foreignCss: "",
            },
        } as ComponentSettingsFormValues,
    });
    currentForm = form;
    return (
        <Form {...form}>
            <ButtonShareStyleFields form={form} tier="product" />
        </Form>
    );
}

function renderBlock(style: ButtonShareStyleValues = {}, tier = "product") {
    currentForm = undefined;
    return render(<Harness tier={tier} style={style} />);
}

function styleValues(): ButtonShareStyleFormValues {
    if (!currentForm) throw new Error("form never rendered");
    return currentForm.getValues().buttonShare.style;
}

const COLOR_CONTROLS = ["bg", "fg", "bc"];
const SIZE_CONTROLS = ["bw", "fs", "py", "px", "mt", "mb", "ml", "mr"];

describe("ButtonShareStyleFields", () => {
    it("renders every style control and no others", () => {
        renderBlock();
        for (const key of COLOR_CONTROLS) {
            expect(
                screen.getByTestId(`buttonShare.style.${key}-hex`)
            ).toBeInTheDocument();
        }
        for (const key of SIZE_CONTROLS) {
            expect(
                screen.getByTestId(`buttonShare.style.${key}-input`)
            ).toBeInTheDocument();
        }
        expect(screen.queryAllByRole("textbox")).toHaveLength(
            COLOR_CONTROLS.length
        );
        expect(
            screen.queryByTestId("buttonShare.style.radius-input")
        ).toBeNull();
    });

    it("offers the transparent choice on the background only", () => {
        renderBlock();
        expect(
            screen.getByTestId("buttonShare.style.bg-none")
        ).toBeInTheDocument();
        expect(screen.queryByTestId("buttonShare.style.fg-none")).toBeNull();
        expect(screen.queryByTestId("buttonShare.style.bc-none")).toBeNull();
    });

    it("sets the transparent token and disables the swatch when none is toggled", () => {
        renderBlock();
        fireEvent.click(screen.getByTestId("buttonShare.style.bg-none"));

        expect(styleValues().bg).toBe(TRANSPARENT);
        expect(
            screen.getByTestId("buttonShare.style.bg-swatch")
        ).toBeDisabled();
        expect(screen.getByTestId("buttonShare.style.bg-hex")).toBeDisabled();
    });

    it("releases the transparent token when none is toggled off", () => {
        renderBlock({ bg: TRANSPARENT });
        fireEvent.click(screen.getByTestId("buttonShare.style.bg-none"));

        expect(styleValues().bg).toBe("");
        expect(
            screen.getByTestId("buttonShare.style.bg-swatch")
        ).not.toBeDisabled();
    });

    it("accepts a hex value typed one character at a time", () => {
        renderBlock();
        const input = screen.getByTestId("buttonShare.style.fg-hex");

        for (const partial of ["#", "#0", "#00", "#000", "#0000", "#00000"]) {
            fireEvent.change(input, { target: { value: partial } });
            expect(styleValues().fg).toBe(partial);
        }

        fireEvent.change(input, { target: { value: "#000000" } });
        fireEvent.blur(input);
        expect(styleValues().fg).toBe("#000000");
    });

    it("reverts an invalid hex to the last valid value on blur", () => {
        renderBlock();
        const input = screen.getByTestId("buttonShare.style.fg-hex");

        fireEvent.change(input, { target: { value: "#112233" } });
        fireEvent.blur(input);
        fireEvent.change(input, { target: { value: "nonsense" } });
        fireEvent.blur(input);

        expect(styleValues().fg).toBe("#112233");
    });

    it("names the swatch separately from the hex input beside it", () => {
        renderBlock();
        const swatch = screen.getByTestId("buttonShare.style.fg-swatch");

        expect(swatch.getAttribute("aria-label")).toMatch(
            /^customize\.components\.style\.swatchLabel:/
        );
    });

    it("reverts to the re-synced colour after the form switches placement", () => {
        const { rerender } = render(<SyncHarness style={{ fg: "#112233" }} />);
        rerender(<SyncHarness style={{ fg: "#445566" }} />);

        const input = screen.getByTestId("buttonShare.style.fg-hex");
        fireEvent.change(input, { target: { value: "nonsense" } });
        fireEvent.blur(input);

        expect(styleValues().fg).toBe("#445566");
    });

    it("leaves a colour unset when an invalid entry has no valid predecessor", () => {
        renderBlock();
        const input = screen.getByTestId("buttonShare.style.bc-hex");

        fireEvent.change(input, { target: { value: "zzz" } });
        fireEvent.blur(input);

        expect(styleValues().bc).toBe("");
        expect(serializeStyleCss(styleValues(), "", "product")).toBeUndefined();
    });

    it("clears every control at once", () => {
        renderBlock({
            bg: "#ffffff",
            fg: "#000000",
            bc: "#123456",
            bw: 2,
            fs: 14,
            py: 8,
            px: 16,
            mt: 4,
            mb: 4,
            ml: 6,
            mr: 6,
        });

        fireEvent.click(screen.getByTestId("buttonShare.style.clear-all"));

        expect(serializeStyleCss(styleValues(), "", "product")).toBeUndefined();
        expect(screen.getByTestId("buttonShare.style.fg-hex")).toHaveValue("");
        expect(screen.getByTestId("buttonShare.style.fs-input")).toHaveValue(
            null
        );
    });

    it("clears a colour back to unset so it emits no declaration", () => {
        renderBlock({ fg: "#112233", bc: "#000000" });
        fireEvent.click(screen.getByTestId("buttonShare.style.fg-clear"));

        expect(styleValues().fg).toBe("");
        expect(serializeStyleCss(styleValues(), "", "product")).not.toContain(
            "color:#112233"
        );
    });

    it("coerces a negative spacing value on blur instead of blocking", () => {
        renderBlock();
        const input = screen.getByTestId("buttonShare.style.py-input");

        fireEvent.change(input, { target: { value: "-8" } });
        fireEvent.blur(input);

        expect(styleValues().py).toBe(0);
    });

    it("coerces a fractional size to an integer on blur", () => {
        renderBlock();
        const input = screen.getByTestId("buttonShare.style.fs-input");

        fireEvent.change(input, { target: { value: "12.6" } });
        fireEvent.blur(input);

        expect(styleValues().fs).toBe(13);
    });

    it("leaves a cleared size unset rather than zero", () => {
        renderBlock({ mt: 4 });
        const input = screen.getByTestId("buttonShare.style.mt-input");

        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);

        expect(styleValues().mt).toBeUndefined();
    });

    it("shows the default-tier caption only at the default tier", () => {
        renderBlock({}, "default");
        expect(
            screen.getByText("customize.components.style.defaultTierHint")
        ).toBeInTheDocument();
    });

    it("hides the default-tier caption at a placement tier", () => {
        renderBlock();
        expect(
            screen.queryByText("customize.components.style.defaultTierHint")
        ).toBeNull();
    });
});
