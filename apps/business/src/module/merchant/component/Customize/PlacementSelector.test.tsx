import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
});

import { PlacementSelector } from "./PlacementSelector";

const GLOBAL = "customize.placements.globalDefault";
const ADD = "customize.placements.add";

function renderSelector(placementIds: string[], onCreatePlacement = vi.fn()) {
    const onTabChange = vi.fn();
    render(
        <PlacementSelector
            activeTab="default"
            placementIds={placementIds}
            onTabChange={onTabChange}
            onCreatePlacement={onCreatePlacement}
            isCreatingPlacement={false}
        />
    );
    return onTabChange;
}

function openDropdown() {
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
}

describe("PlacementSelector", () => {
    it("lists the global entry, each placement and the add entry", () => {
        renderSelector(["home", "cart"]);
        openDropdown();

        expect(screen.getByRole("option", { name: GLOBAL })).toBeTruthy();
        expect(screen.getByRole("option", { name: "home" })).toBeTruthy();
        expect(screen.getByRole("option", { name: "cart" })).toBeTruthy();
        expect(screen.getByRole("option", { name: ADD })).toBeTruthy();
    });

    it("disables the add entry once ten placements exist", () => {
        renderSelector(Array.from({ length: 10 }, (_, i) => `place-${i}`));
        openDropdown();

        expect(
            screen
                .getByRole("option", { name: ADD })
                .getAttribute("aria-disabled")
        ).toBe("true");
    });

    it("opens the creation dialog from the add entry without changing the selection", () => {
        const onTabChange = renderSelector(["home"]);
        openDropdown();
        fireEvent.click(screen.getByRole("option", { name: ADD }));

        expect(
            screen.getByText("customize.placements.dialog.title")
        ).toBeTruthy();
        expect(onTabChange).not.toHaveBeenCalled();
    });

    it("refuses a placement id that collides with the global entry", () => {
        const onCreatePlacement = vi.fn();
        renderSelector([], onCreatePlacement);
        openDropdown();
        fireEvent.click(screen.getByRole("option", { name: ADD }));

        fireEvent.change(screen.getByPlaceholderText("homepage_banner"), {
            target: { value: "default" },
        });
        fireEvent.click(screen.getByText("customize.placements.dialog.create"));

        expect(
            screen.getByText("customize.placements.dialog.errorExists")
        ).toBeTruthy();
        expect(onCreatePlacement).not.toHaveBeenCalled();
    });

    it("reports the picked placement id", () => {
        const onTabChange = renderSelector(["home"]);
        openDropdown();
        fireEvent.click(screen.getByRole("option", { name: "home" }));

        expect(onTabChange).toHaveBeenCalledWith("home");
    });
});
