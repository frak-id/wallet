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

describe("BillingInfoSheet failed-save handling (B12)", () => {
    it("keeps the sheet open with the edits when onSave never succeeds, closes on success", async () => {
        // Simulated mutation: first call fails (never invokes onSuccess),
        // second call succeeds.
        let call = 0;
        const onSave = vi.fn(
            (_next: BillingInfo, opts?: { onSuccess?: () => void }) => {
                call += 1;
                if (call > 1) opts?.onSuccess?.();
            }
        );
        render(
            <BillingInfoSheet
                mode="edit"
                info={INFO}
                onSave={onSave}
                saveFailed={call === 1}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: EDIT }));

        const companyInput =
            await screen.findByPlaceholderText(COMPANY_PLACEHOLDER);
        fireEvent.change(companyInput, { target: { value: "Changed" } });

        const save = screen.getByRole("button", { name: SAVE_CHANGES });
        await waitFor(() => expect(save).not.toBeDisabled());

        // First submit: save fails (no onSuccess) — the sheet must stay
        // open and the edited value must still be there.
        fireEvent.click(save);
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(screen.getByPlaceholderText(COMPANY_PLACEHOLDER)).toHaveValue(
            "Changed"
        );

        // Second submit: save succeeds — the sheet closes.
        fireEvent.click(screen.getByRole("button", { name: SAVE_CHANGES }));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(
                screen.queryByPlaceholderText(COMPANY_PLACEHOLDER)
            ).not.toBeInTheDocument()
        );
    });

    it("shows the inline save-error message when saveFailed is set", async () => {
        render(
            <BillingInfoSheet
                mode="edit"
                info={INFO}
                onSave={() => {}}
                saveFailed
            />
        );
        fireEvent.click(screen.getByRole("button", { name: EDIT }));

        expect(
            await screen.findByText("settings.billing.errors.save")
        ).toBeInTheDocument();
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
