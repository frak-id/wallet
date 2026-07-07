import { Input } from "@frak-labs/design-system/components/Input";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { EditField } from "./index";

type Values = { name: string };

/**
 * Minimal harness: a real `useForm` + `Form` + `FormField` +
 * `FormControl`, wired exactly as a migrated Phase-B consumer — `label`/`hint`
 * go to the DS control, `EditField` only keeps `tone`.
 */
function Harness({
    defaultValues,
    rules,
    label,
    hint,
    tone,
    submitOnMount,
}: {
    defaultValues: Values;
    rules?: Parameters<typeof FormField<Values, "name">>[0]["rules"];
    label?: ReactNode;
    hint?: ReactNode;
    tone?: "plain" | "card";
    submitOnMount?: boolean;
}) {
    const form = useForm<Values>({ defaultValues, mode: "onSubmit" });

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(() => {})}
                ref={(el) => {
                    if (el && submitOnMount) {
                        el.requestSubmit();
                    }
                }}
            >
                <FormField
                    control={form.control}
                    name="name"
                    rules={rules}
                    render={({ field }) => (
                        <EditField tone={tone}>
                            <FormControl>
                                <Input label={label} hint={hint} {...field} />
                            </FormControl>
                        </EditField>
                    )}
                />
            </form>
        </Form>
    );
}

describe("EditField (Phase-B DS label/hint delegation)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<Harness defaultValues={{ name: "" }} label="Company name" />);

        const input = screen.getByLabelText("Company name");
        expect(input).toBeInTheDocument();
        const label = screen.getByText("Company name");
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("renders label + hint together", () => {
        render(
            <Harness
                defaultValues={{ name: "" }}
                label="Company name"
                hint="As on your invoice"
            />
        );

        expect(screen.getByText("Company name")).toBeInTheDocument();
        expect(screen.getByText("As on your invoice")).toBeInTheDocument();
        expect(
            screen.getByLabelText("Company name")
        ).toHaveAccessibleDescription("As on your invoice");
    });

    it("renders no hint node when hint is omitted", () => {
        render(<Harness defaultValues={{ name: "" }} label="Company name" />);

        expect(
            screen.queryByText("As on your invoice")
        ).not.toBeInTheDocument();
    });

    it("EditField renders exactly one label — the DS control's, not a second FormLabel", () => {
        const { container } = render(
            <Harness defaultValues={{ name: "" }} label="Company name" />
        );

        expect(container.querySelectorAll("label")).toHaveLength(1);
    });

    it("tone='card' still wraps the label-less EditField body", () => {
        const { container } = render(
            <Harness
                defaultValues={{ name: "" }}
                label="Company name"
                tone="card"
            />
        );

        const input = screen.getByLabelText("Company name");
        const label = screen.getByText("Company name");
        // The card wrapper (EditField's styles.card div) contains both the
        // DS-rendered label and the control.
        const card = container.querySelector("div > div");
        expect(card).not.toBeNull();
        expect(card).toContainElement(input);
        expect(card).toContainElement(label);
    });

    it("shows the FormMessage on invalid submit even without an EditField label", async () => {
        render(
            <Harness
                defaultValues={{ name: "" }}
                rules={{ required: "Name is required" }}
                label="Company name"
                submitOnMount
            />
        );

        expect(await screen.findByText("Name is required")).toBeInTheDocument();
    });
});
