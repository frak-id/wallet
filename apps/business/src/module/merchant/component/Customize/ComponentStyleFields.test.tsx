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
import { ComponentStyleFields } from "./ComponentEditor";
import type {
    ButtonShareStyleFormValues,
    ComponentSettingsFormValues,
} from "./types";

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
            <ComponentStyleFields
                selectedComponent="buttonShare"
                form={form}
                lang="default"
                configLang="en"
                tier={tier}
            />
        </Form>
    );
}

function styleValues(): ButtonShareStyleFormValues {
    if (!currentForm) throw new Error("form never rendered");
    return currentForm.getValues().buttonShare.style;
}

function openPanel() {
    fireEvent.click(screen.getByText("customize.components.style.section"));
}

describe("ComponentStyleFields", () => {
    it("renders nothing for a component without style controls", () => {
        const form = { watch: () => undefined } as never;
        const { container } = render(
            <ComponentStyleFields
                selectedComponent="banner"
                form={form}
                lang="default"
                configLang="en"
                tier="default"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("keeps the style controls collapsed until asked", () => {
        render(<Harness tier="default" style={{}} />);
        expect(screen.queryByTestId("boxModel")).toBeNull();

        openPanel();
        expect(screen.getByTestId("boxModel")).toBeInTheDocument();
    });

    it("drops the box-model link state when the tier changes", () => {
        const { rerender } = render(
            <Harness tier="hero" style={{ mt: 4, mb: 4, ml: 4, mr: 4 }} />
        );
        openPanel();
        expect(screen.getByTestId("boxModel-margin-link")).toHaveAttribute(
            "aria-pressed",
            "true"
        );

        rerender(
            <Harness tier="product" style={{ mt: 4, mb: 9, ml: 0, mr: 0 }} />
        );

        expect(screen.getByTestId("boxModel-margin-link")).toHaveAttribute(
            "aria-pressed",
            "false"
        );
        fireEvent.change(screen.getByTestId("boxModel-mt"), {
            target: { value: "20" },
        });
        expect(styleValues()).toMatchObject({ mt: 20, mb: 9 });
    });
});
