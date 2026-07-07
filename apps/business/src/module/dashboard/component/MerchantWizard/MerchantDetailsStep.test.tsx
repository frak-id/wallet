import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Form } from "@/module/forms/Form";
import type { MerchantNew } from "@/types/Merchant";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { MerchantDetailsStep } from "./MerchantDetailsStep";

const DEFAULT_VALUES: MerchantNew = {
    name: "",
    domain: "",
    setupCode: "",
    currency: "eure",
};

/**
 * `MerchantDetailsStep` reads its form via `useFormContext<MerchantNew>()` —
 * untyped at runtime like `FormTitle`'s harness. Domain stays empty so the
 * DNS-lookup query (`useDnsTxtRecordToSet`, gated by `enabled: !!domain`)
 * never fires; a `QueryClientProvider` is still required for the hook call.
 */
function Harness() {
    const form = useForm({ defaultValues: DEFAULT_VALUES, mode: "onSubmit" });
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(() => {})}>
                    <MerchantDetailsStep />
                    <button type="submit">submit</button>
                </form>
            </Form>
        </QueryClientProvider>
    );
}

describe("MerchantDetailsStep name field (FRA-246/U6 — WizardFieldCard label delegated to DS Input)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "merchant.create.fields.name.label"
        );
        expect(input).toBeInTheDocument();
        const label = screen.getByText("merchant.create.fields.name.label");
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("shows the FieldError once the required field is touched and submitted empty", async () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "merchant.create.fields.name.label"
        );
        fireEvent.change(input, { target: { value: "a" } });
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);
        fireEvent.click(screen.getByRole("button", { name: "submit" }));

        expect(
            await screen.findByText("merchant.create.fields.name.required")
        ).toBeInTheDocument();
    });
});
