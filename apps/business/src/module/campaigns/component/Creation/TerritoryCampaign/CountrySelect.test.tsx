import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const t = (key: string) => key;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

import { CountrySelect } from "./CountrySelect";

// The trigger is a `<div>` because it nests its own chip-remove and clear-all
// buttons. Radix hands `asChild` a click handler only, so these attributes are
// the whole keyboard path for a required wizard step.
describe("CountrySelect trigger", () => {
    it("is a labelled combobox in the tab order", () => {
        render(<CountrySelect value={[]} onChange={() => {}} />);

        const trigger = screen.getByRole("combobox");
        expect(trigger.getAttribute("tabindex")).toBe("0");
        expect(trigger.getAttribute("aria-expanded")).toBe("false");
        expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
        expect(trigger.getAttribute("aria-label")).toBeTruthy();
    });

    it("opens on Enter", () => {
        render(<CountrySelect value={[]} onChange={() => {}} />);
        const trigger = screen.getByRole("combobox");
        trigger.focus();

        fireEvent.keyDown(trigger, { key: "Enter" });

        expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe(
            "true"
        );
    });

    it("opens on Space", () => {
        render(<CountrySelect value={[]} onChange={() => {}} />);

        fireEvent.keyDown(screen.getByRole("combobox"), { key: " " });

        expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe(
            "true"
        );
    });

    it("ignores keys that are not Enter or Space", () => {
        render(<CountrySelect value={[]} onChange={() => {}} />);

        fireEvent.keyDown(screen.getByRole("combobox"), { key: "a" });

        expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe(
            "false"
        );
    });
});
