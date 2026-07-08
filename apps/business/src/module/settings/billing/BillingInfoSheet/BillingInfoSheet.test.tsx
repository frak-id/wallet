import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BillingInfo } from "../types";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { BillingInfoSheet } from "./index";

const INFO: BillingInfo = {
    companyName: "Nowa",
    vatNumber: "FR76485215479",
    streetAddress: "42 rue Legendre",
    city: "Paris",
    postalCode: "75017",
    country: "FR",
    billingEmail: "nowa@nowa-water.com",
};

const ADD = "settings.billing.actions.add";
const EDIT = "settings.billing.actions.edit";
const SAVE = "settings.billing.actions.save";
const SAVE_CHANGES = "settings.billing.actions.saveChanges";
const COMPANY_PLACEHOLDER = "settings.billing.fields.companyName.placeholder";

describe("BillingInfoSheet save gating", () => {
    it("edit: Save is disabled until any change, then enabled (Figma note)", async () => {
        render(<BillingInfoSheet mode="edit" info={INFO} onSave={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: EDIT }));

        const save = await screen.findByRole("button", {
            name: SAVE_CHANGES,
        });
        expect(save).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText(COMPANY_PLACEHOLDER), {
            target: { value: "Changed" },
        });
        // Edit enables on dirty alone — no validity gate.
        await waitFor(() => expect(save).not.toBeDisabled());
    });

    it("add: a single dirty-but-invalid change keeps Save disabled", async () => {
        render(<BillingInfoSheet mode="add" onSave={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: ADD }));

        const save = await screen.findByRole("button", { name: SAVE });
        expect(save).toBeDisabled();

        // Only one of the required fields filled → dirty but invalid.
        fireEvent.change(screen.getByPlaceholderText(COMPANY_PLACEHOLDER), {
            target: { value: "Nowa" },
        });
        // Add requires a complete, valid form — stays disabled.
        await waitFor(() => expect(save).toBeDisabled());
    });
});

// Company name is a migrated Phase-B field: label/hint now come
// from the DS Input, not EditField. Confirms the delegated label still
// associates with the control and the FormMessage still fires on invalid
// submit through FormControl's forwarded id/aria-invalid.
describe("BillingInfoSheet migrated field", () => {
    it("associates the companyName label to its control", async () => {
        render(<BillingInfoSheet mode="add" onSave={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: ADD }));

        await screen.findByPlaceholderText(COMPANY_PLACEHOLDER);
        const input = screen.getByLabelText(
            "settings.billing.fields.companyName.label"
        );
        expect(input).toHaveAttribute("placeholder", COMPANY_PLACEHOLDER);
    });

    it("shows the required-field message on invalid submit", async () => {
        render(<BillingInfoSheet mode="add" onSave={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: ADD }));

        const input = await screen.findByPlaceholderText(COMPANY_PLACEHOLDER);
        const form = input.closest("form") as HTMLFormElement;
        fireEvent.submit(form);

        expect(
            await screen.findAllByText("settings.billing.validation.required")
        ).not.toHaveLength(0);
    });
});
