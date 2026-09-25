import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const mutate = vi.fn();
const mutationState = { isPending: false, isError: false };

vi.mock("../useBillingAdmin", () => ({
    useUpdateBillingCountry: () => ({ mutate, ...mutationState }),
}));

beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
});

import { BillingCountryControl } from "./BillingCountryControl";

const SAVE = "settings.billing.admin.country.save";

function pickCountry(name: string) {
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name }));
}

describe("BillingCountryControl", () => {
    beforeEach(() => {
        mutate.mockReset();
        mutationState.isPending = false;
        mutationState.isError = false;
    });

    it("keeps Save disabled until a different country is picked", () => {
        render(<BillingCountryControl merchantId="m-1" currentCountry="FR" />);

        expect(screen.getByRole("button", { name: SAVE })).toBeDisabled();

        pickCountry("Germany");

        expect(screen.getByRole("button", { name: SAVE })).toBeEnabled();
    });

    it("saves only the picked country code", () => {
        render(<BillingCountryControl merchantId="m-1" />);

        pickCountry("France");
        fireEvent.click(screen.getByRole("button", { name: SAVE }));

        expect(mutate).toHaveBeenCalledWith("FR", expect.any(Object));
    });

    it("shows the error copy when the save failed", () => {
        mutationState.isError = true;
        render(<BillingCountryControl merchantId="m-1" currentCountry="FR" />);

        expect(
            screen.getByText("settings.billing.admin.country.error")
        ).toBeInTheDocument();
    });
});
