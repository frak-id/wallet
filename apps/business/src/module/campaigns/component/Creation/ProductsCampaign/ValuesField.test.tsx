import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const t = (key: string) => key;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

import { useForm, useWatch } from "react-hook-form";
import { ValuesField } from "./index";
import type { ProductsFormValues } from "./utils";

function Harness() {
    const form = useForm<ProductsFormValues>({
        values: {
            mode: "specific",
            field: "sku",
            operator: "in",
            values: ["A", "B", "C"],
            valueTo: "",
        } as ProductsFormValues,
    });
    const values = (useWatch({ control: form.control, name: "values" }) ??
        []) as string[];
    return (
        <ValuesField
            control={form.control}
            values={values}
            setValues={(next) =>
                form.setValue("values", next, { shouldDirty: true })
            }
        />
    );
}

const inputs = () => screen.getAllByRole("textbox") as HTMLInputElement[];
const removeButtons = () =>
    screen
        .getAllByRole("button")
        .filter(
            (b) =>
                b.getAttribute("aria-label") ===
                "campaigns.create.products.removeValue"
        );

describe("ValuesField", () => {
    it("drops the removed value and keeps the rest", () => {
        render(<Harness />);
        expect(inputs().map((i) => i.value)).toEqual(["A", "B", "C"]);

        fireEvent.click(removeButtons()[0]);

        expect(inputs().map((i) => i.value)).toEqual(["B", "C"]);
    });

    // A real mouse press focuses the delete button before the click, so these
    // focus it explicitly — asserting on a bare `click()` passes against code
    // that is broken in the browser.
    function pressRemove(index: number) {
        removeButtons()[index].focus();
        fireEvent.click(removeButtons()[index]);
    }

    it("keeps the caret on its own value when a row above is removed", () => {
        render(<Harness />);
        inputs()[2].focus();

        pressRemove(0);

        return vi.waitFor(() =>
            expect((document.activeElement as HTMLInputElement).value).toBe("C")
        );
    });

    it("moves the caret to the successor when its own row is removed", () => {
        render(<Harness />);
        inputs()[0].focus();

        pressRemove(0);

        return vi.waitFor(() =>
            expect((document.activeElement as HTMLInputElement).value).toBe("B")
        );
    });

    it("falls back to the new last row when the tail is removed", () => {
        render(<Harness />);
        inputs()[2].focus();

        pressRemove(2);

        return vi.waitFor(() =>
            expect((document.activeElement as HTMLInputElement).value).toBe("B")
        );
    });
});
