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
import { buildLook } from "../style/presets";
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
    style: ButtonShareStyleFormValues;
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
            <ButtonShareStyleFields
                form={form}
                tier={tier}
                previewLabel="Share & earn"
            />
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

/** Radix tab triggers commit on mousedown, which `click` alone does not fire. */
function selectTab(testId: string) {
    fireEvent.mouseDown(screen.getByTestId(testId), { button: 0 });
}

describe("ButtonShareStyleFields — presets", () => {
    it("starts on the theme look with nothing stored", () => {
        renderBlock();

        expect(screen.getByTestId("style-look-theme")).toHaveAttribute(
            "data-state",
            "active"
        );
        expect(serializeStyleCss(styleValues(), "", "product")).toBeUndefined();
    });

    it("hides the colour and size controls while the theme look is active", () => {
        renderBlock();

        expect(screen.queryByTestId("style-accent-hex")).toBeNull();
        expect(screen.queryByTestId("style-size-m")).toBeNull();
    });

    it("writes a whole look when a preset is picked", () => {
        renderBlock();
        selectTab("style-look-solid");

        const values = styleValues();
        expect(values.bg).toBe("#1e1e1e");
        expect(values.fg).toBe("#ffffff");
        expect(values.bw).toBe(0);
        expect(values.py).toBe(12);
    });

    it("keeps the outline look transparent and borders it with the accent", () => {
        renderBlock();
        selectTab("style-look-outline");

        const values = styleValues();
        expect(values.bg).toBe(TRANSPARENT);
        expect(values.bc).toBe("#1e1e1e");
        expect(values.bw).toBe(1);
    });

    it("re-reads the active look from the stored values", () => {
        renderBlock(buildLook("outline", "m", "#3366cc"));

        expect(screen.getByTestId("style-look-outline")).toHaveAttribute(
            "data-state",
            "active"
        );
    });

    it("offers exactly three looks until one is hand-edited", () => {
        renderBlock();

        expect(screen.getAllByRole("tab")).toHaveLength(3);
        expect(screen.queryByTestId("style-look-custom")).toBeNull();
    });

    it("never shows an accent picker beside the looks", () => {
        renderBlock(buildLook("solid", "m", "#1e1e1e"));

        expect(screen.queryByTestId("style-accent-hex")).toBeNull();
        expect(screen.queryByTestId("style-accent-swatch")).toBeNull();
    });

    it("carries the hand-set colour across a look change", () => {
        renderBlock({ ...buildLook("outline", "m", "#3366cc") });
        selectTab("style-look-solid");

        expect(styleValues().bg).toBe("#3366cc");
    });

    it("rescales the look without losing its colours", () => {
        renderBlock(buildLook("solid", "m", "#1e1e1e"));
        selectTab("style-size-l");

        const values = styleValues();
        expect(values.fs).toBe(17);
        expect(values.px).toBe(26);
        expect(values.bg).toBe("#1e1e1e");
    });

    it("falls back to the custom look once a colour is hand-edited", () => {
        renderBlock(buildLook("solid", "m", "#1e1e1e"));
        fireEvent.click(screen.getByTestId("buttonShare.style.bc-clear"));
        fireEvent.change(screen.getByTestId("buttonShare.style.bc-hex"), {
            target: { value: "#abcdef" },
        });

        expect(screen.getByTestId("style-look-custom")).toHaveAttribute(
            "data-state",
            "active"
        );
    });

    it("keeps the size control available in the custom look", () => {
        renderBlock({ ...buildLook("solid", "m", "#1e1e1e"), bc: "#abcdef" });

        expect(screen.getByTestId("style-size-m")).toBeInTheDocument();
    });

    it("clears every control at once, on screen as well as in the values", () => {
        renderBlock({
            ...buildLook("outline", "l", "#3366cc"),
            fw: 700,
            mt: 12,
            mu: "%",
        });

        fireEvent.click(screen.getByTestId("buttonShare.style.clear-all"));

        expect(serializeStyleCss(styleValues(), "", "product")).toBeUndefined();
        expect(screen.getByTestId("buttonShare.style.fg-hex")).toHaveValue("");
        expect(screen.getByTestId("buttonShare.style.fs-input")).toHaveValue(
            null
        );
        expect(screen.getByTestId("style-look-theme")).toHaveAttribute(
            "data-state",
            "active"
        );
    });

    it("disables the clear-all once nothing is stored", () => {
        renderBlock();
        expect(
            screen.getByTestId("buttonShare.style.clear-all")
        ).toBeDisabled();
    });

    it("ignores keys left behind by an empty registered field", () => {
        renderBlock({ bg: "", fg: "", bc: "", pu: "%" });

        expect(
            screen.getByTestId("buttonShare.style.clear-all")
        ).toBeDisabled();
        expect(screen.getByTestId("style-look-theme")).toHaveAttribute(
            "data-state",
            "active"
        );
    });
});

describe("ButtonShareStyleFields — box model", () => {
    it("keeps margins when the look changes", () => {
        renderBlock({ mt: 16, mb: 8 });
        selectTab("style-look-solid");

        expect(styleValues().mt).toBe(16);
        expect(styleValues().mb).toBe(8);
    });

    it("edits one margin side at a time when unlinked", () => {
        renderBlock({ mt: 4, mb: 8, ml: 0, mr: 0 });
        fireEvent.change(screen.getByTestId("boxModel-mt"), {
            target: { value: "20" },
        });

        expect(styleValues().mt).toBe(20);
        expect(styleValues().mb).toBe(8);
    });

    it("writes all four sides while the margin link is on", () => {
        renderBlock({ mt: 4, mb: 4, ml: 4, mr: 4 });
        fireEvent.change(screen.getByTestId("boxModel-ml"), {
            target: { value: "12" },
        });

        expect(styleValues()).toMatchObject({
            mt: 12,
            mb: 12,
            ml: 12,
            mr: 12,
        });
    });

    it("rebuilds the link state when the tier changes", () => {
        const linked = { mt: 4, mb: 4, ml: 4, mr: 4 };
        const unlinked = { mt: 4, mb: 9, ml: 0, mr: 0 };
        const { rerender } = render(
            <Harness key="a" tier="a" style={linked} />
        );

        // A keyed remount is what ComponentStyleFields does per placement.
        rerender(<Harness key="b" tier="b" style={unlinked} />);
        fireEvent.change(screen.getByTestId("boxModel-mt"), {
            target: { value: "20" },
        });

        expect(styleValues().mt).toBe(20);
        expect(styleValues().mb).toBe(9);
    });

    it("unlinks the margin sides on demand", () => {
        renderBlock({ mt: 4, mb: 4, ml: 4, mr: 4 });
        fireEvent.click(screen.getByTestId("boxModel-margin-link"));
        fireEvent.change(screen.getByTestId("boxModel-mt"), {
            target: { value: "30" },
        });

        expect(styleValues().mt).toBe(30);
        expect(styleValues().mb).toBe(4);
    });

    it("mirrors a padding edge onto its axis", () => {
        renderBlock({ py: 10, px: 20 });
        fireEvent.change(screen.getByTestId("boxModel-py-mirror"), {
            target: { value: "6" },
        });

        expect(styleValues().py).toBe(6);
        expect(styleValues().px).toBe(20);
    });

    it("ties both padding axes when the link is on", () => {
        renderBlock({ py: 8, px: 8 });
        fireEvent.change(screen.getByTestId("boxModel-px"), {
            target: { value: "14" },
        });

        expect(styleValues()).toMatchObject({ py: 14, px: 14 });
    });

    it("clamps a margin to the control ceiling", () => {
        renderBlock();
        fireEvent.change(screen.getByTestId("boxModel-mt"), {
            target: { value: "900" },
        });

        expect(styleValues().mt).toBe(120);
    });

    it("leaves a cleared spacing cell unset rather than zero", () => {
        renderBlock({ mt: 4 });
        fireEvent.change(screen.getByTestId("boxModel-mt"), {
            target: { value: "" },
        });

        expect(styleValues().mt).toBeUndefined();
    });

    it("steps a spacing cell with the arrow keys", () => {
        renderBlock({ py: 10 });
        fireEvent.keyDown(screen.getByTestId("boxModel-py"), {
            key: "ArrowUp",
            shiftKey: true,
        });

        expect(styleValues().py).toBe(20);
    });

    it("shows the button wording in the core cell", () => {
        renderBlock();
        expect(screen.getByText("Share & earn")).toBeInTheDocument();
    });
});

describe("ButtonShareStyleFields — spacing units", () => {
    it("starts both groups on pixels", () => {
        renderBlock({ py: 10, mt: 10 });

        expect(screen.getByTestId("boxModel-padding-unit")).toHaveTextContent(
            "px"
        );
        expect(screen.getByTestId("boxModel-margin-unit")).toHaveTextContent(
            "px"
        );
    });

    it("flips a group to percentages without touching the other", () => {
        renderBlock({ py: 10, mt: 10 });
        fireEvent.click(screen.getByTestId("boxModel-padding-unit"));

        expect(styleValues().pu).toBe("%");
        expect(styleValues().mu).toBeUndefined();
    });

    it("emits the percentage through the codec", () => {
        renderBlock({ py: 4, mt: 10 });
        fireEvent.click(screen.getByTestId("boxModel-padding-unit"));

        expect(serializeStyleCss(styleValues(), "", "product")).toContain(
            "padding-top:4%!important"
        );
    });

    it("flips back to pixels on a second press", () => {
        renderBlock({ mt: 10, mu: "%" });
        fireEvent.click(screen.getByTestId("boxModel-margin-unit"));

        expect(styleValues().mu).toBe("px");
    });

    it("pulls an over-range value down when switching to percentages", () => {
        renderBlock({ mt: 118, mb: 4 });
        fireEvent.click(screen.getByTestId("boxModel-margin-unit"));

        expect(styleValues().mt).toBe(100);
        expect(styleValues().mb).toBe(4);
    });

    it("clamps a typed percentage to 100", () => {
        renderBlock({ mt: 10, mu: "%" });
        fireEvent.change(screen.getByTestId("boxModel-mt"), {
            target: { value: "250" },
        });

        expect(styleValues().mt).toBe(100);
    });

    it("keeps the margin unit across a look change", () => {
        renderBlock({ mt: 8, mu: "%" });
        selectTab("style-look-solid");

        expect(styleValues().mu).toBe("%");
    });
});

describe("ButtonShareStyleFields — colours and border", () => {
    it("lists every colour row without a nested disclosure", () => {
        renderBlock();

        for (const key of ["bg", "fg", "bc"]) {
            expect(
                screen.getByTestId(`buttonShare.style.${key}-hex`)
            ).toBeInTheDocument();
        }
        expect(
            screen.getByTestId("buttonShare.style.bw-input")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("buttonShare.style.fs-input")
        ).toBeInTheDocument();
    });

    it("offers the transparent choice on the background only", () => {
        renderBlock();

        expect(
            screen.getByTestId("buttonShare.style.bg-none")
        ).toBeInTheDocument();
        expect(screen.queryByTestId("buttonShare.style.fg-none")).toBeNull();
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

    it("clamps an out-of-range text size on blur", () => {
        renderBlock();
        const input = screen.getByTestId("buttonShare.style.fs-input");

        fireEvent.change(input, { target: { value: "400" } });
        fireEvent.blur(input);

        expect(styleValues().fs).toBe(48);
    });

    it("offers the weight select with the theme default selected", () => {
        renderBlock();
        expect(
            screen.getByTestId("buttonShare.style.fw-select")
        ).toHaveTextContent("customize.components.style.weight_theme");
    });

    it("shows the stored weight", () => {
        renderBlock({ fw: 600 });
        expect(
            screen.getByTestId("buttonShare.style.fw-select")
        ).toHaveTextContent("customize.components.style.weight_600");
    });

    it("keeps the weight across a look change", () => {
        renderBlock({ fw: 700 });
        selectTab("style-look-solid");

        expect(styleValues().fw).toBe(700);
    });

    it("drops the weight when everything is cleared", () => {
        renderBlock({ fw: 700 });
        fireEvent.click(screen.getByTestId("buttonShare.style.clear-all"));

        expect(serializeStyleCss(styleValues(), "", "product")).toBeUndefined();
        expect(
            screen.getByTestId("buttonShare.style.fw-select")
        ).toHaveTextContent("customize.components.style.weight_theme");
    });

    it("coerces a fractional border width on blur", () => {
        renderBlock();
        const input = screen.getByTestId("buttonShare.style.bw-input");

        fireEvent.change(input, { target: { value: "2.6" } });
        fireEvent.blur(input);

        expect(styleValues().bw).toBe(3);
    });
});

describe("ButtonShareStyleFields — tier hint", () => {
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
