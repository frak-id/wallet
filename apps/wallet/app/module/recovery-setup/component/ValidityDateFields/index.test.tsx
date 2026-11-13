import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ValidityDateFields } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ValidityDateFields", () => {
    it("names each date field by its label and describes it by its help text", () => {
        render(
            <ValidityDateFields
                startDate="2026-11-20"
                endDate="2027-11-20"
                onStartChange={vi.fn()}
                onEndChange={vi.fn()}
            />
        );

        const start = screen.getByLabelText(
            "wallet.recoverySetup.password.startLabel"
        );
        const end = screen.getByLabelText(
            "wallet.recoverySetup.password.endLabel"
        );
        expect(start).toHaveValue("2026-11-20");
        expect(end).toHaveValue("2027-11-20");
        expect(start).toHaveAccessibleDescription(
            "wallet.recoverySetup.password.startHelp"
        );
        expect(end).toHaveAccessibleDescription(
            "wallet.recoverySetup.password.endHelp"
        );
    });
});
