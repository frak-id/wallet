import { render, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it } from "vitest";
import { Form } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
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
    beforeEach(() => {
        campaignStore.getState().reset();
    });

    it("should render all trigger options when no goal is set", () => {
        const { container } = render(<TriggerSelectorFixture />);

        expect(
            within(container).getByRole("radio", { name: "Referral" })
        ).toBeInTheDocument();
        expect(
            within(container).getByRole("radio", {
                name: "Referral Link Created",
            })
        ).toBeInTheDocument();
        expect(
            within(container).getByRole("radio", {
                name: "Purchase completed",
            })
        ).toBeInTheDocument();
        expect(
            within(container).getByRole("radio", { name: "Custom" })
        ).toBeInTheDocument();
    });

    it("should show only purchase trigger for sales goal", () => {
        campaignStore.getState().updateDraft((d) => ({
            ...d,
            metadata: { ...d.metadata, goal: "sales" },
        }));
        const { container } = render(
            <TriggerSelectorFixture trigger="purchase" />
        );

        expect(
            within(container).getByRole("radio", {
                name: "Purchase completed",
            })
        ).toBeInTheDocument();
        expect(
            within(container).queryByRole("radio", { name: "Referral" })
        ).not.toBeInTheDocument();
        expect(
            within(container).queryByRole("radio", { name: "Custom" })
        ).not.toBeInTheDocument();
    });

    it("should show referral and link created triggers for traffic goal", () => {
        campaignStore.getState().updateDraft((d) => ({
            ...d,
            metadata: { ...d.metadata, goal: "traffic" },
        }));
        const { container } = render(<TriggerSelectorFixture />);

        expect(
            within(container).getByRole("radio", { name: "Referral" })
        ).toBeInTheDocument();
        expect(
            within(container).getByRole("radio", {
                name: "Referral Link Created",
            })
        ).toBeInTheDocument();
        expect(
            within(container).queryByRole("radio", {
                name: "Purchase completed",
            })
        ).not.toBeInTheDocument();
    });

    it("should show referral and custom triggers for registration goal", () => {
        campaignStore.getState().updateDraft((d) => ({
            ...d,
            metadata: { ...d.metadata, goal: "registration" },
        }));
        const { container } = render(<TriggerSelectorFixture />);

        expect(
            within(container).getByRole("radio", { name: "Referral" })
        ).toBeInTheDocument();
        expect(
            within(container).getByRole("radio", { name: "Custom" })
        ).toBeInTheDocument();
        expect(
            within(container).queryByRole("radio", {
                name: "Purchase completed",
            })
        ).not.toBeInTheDocument();
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
