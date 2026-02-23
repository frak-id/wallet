import { render, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { Form } from "@/module/forms/Form";
import { TriggerSelector } from "./TriggerSelector";

type FormValues = {
    trigger: "referral" | "create_referral_link" | "purchase" | "custom";
};

function TriggerSelectorFixture({
    trigger = "referral",
}: {
    trigger?: FormValues["trigger"];
}) {
    const form = useForm<FormValues>({
        defaultValues: { trigger },
    });

    return (
        <Form {...form}>
            <TriggerSelector />
        </Form>
    );
}

describe("TriggerSelector", () => {
    it("should render custom trigger option", () => {
        const { container } = render(<TriggerSelectorFixture />);

        expect(
            within(container).getByRole("radio", { name: "Custom" })
        ).toBeInTheDocument();
    });

    it("should select custom trigger when form value is custom", () => {
        const { container } = render(
            <TriggerSelectorFixture trigger="custom" />
        );

        expect(
            within(container).getByRole("radio", { name: "Custom" })
        ).toHaveAttribute("data-state", "checked");
    });
});
