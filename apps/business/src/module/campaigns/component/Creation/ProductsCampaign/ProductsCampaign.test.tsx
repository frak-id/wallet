import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: { index?: number }) =>
            options?.index ? `${key}.${options.index}` : key,
    }),
}));

import { AdvancedScopeNotice, PredicateField, ValuesField } from "./index";
import {
    DEFAULT_PRODUCTS_FORM,
    operatorsFor,
    type ProductsFormValues,
} from "./utils";

/**
 * The fields only need a `Control<ProductsFormValues>`, so a minimal `useForm`
 * harness (mirroring `ReferralChainCampaign.test.tsx`) exercises them without
 * the store/router/save-campaign plumbing of the page.
 */
function PredicateHarness({
    defaults,
}: {
    defaults?: Partial<ProductsFormValues>;
}) {
    const form = useForm<ProductsFormValues>({
        defaultValues: { ...DEFAULT_PRODUCTS_FORM, ...defaults },
        mode: "onChange",
    });
    return (
        <form>
            <PredicateField
                control={form.control}
                setOperator={(operator) => form.setValue("operator", operator)}
            />
        </form>
    );
}

function ValuesHarness({
    defaults,
    onValues,
}: {
    defaults?: Partial<ProductsFormValues>;
    onValues?: (next: string[]) => void;
}) {
    const form = useForm<ProductsFormValues>({
        defaultValues: { ...DEFAULT_PRODUCTS_FORM, ...defaults },
        mode: "onChange",
    });
    const values = form.watch("values");
    return (
        <form>
            <ValuesField
                control={form.control}
                values={values}
                setValues={(next) => {
                    form.setValue("values", next);
                    onValues?.(next);
                }}
            />
        </form>
    );
}

describe("PredicateField", () => {
    it("labels both selects", () => {
        render(<PredicateHarness />);

        expect(
            screen.getByText("campaigns.create.products.fieldLabel")
        ).toBeInTheDocument();
        expect(
            screen.getByText("campaigns.create.products.operatorLabel")
        ).toBeInTheDocument();
    });

    it("offers only operators valid for the selected field kind", () => {
        // The backend rejects a string operator on a numeric field, so the
        // two operator sets must never be offered together.
        expect(operatorsFor("sku")).toContain("starts_with");
        expect(operatorsFor("quantity")).not.toContain("starts_with");
        expect(operatorsFor("quantity")).toContain("between");
    });
});

describe("ValuesField", () => {
    it("renders a single labelled input for a scalar operator", () => {
        render(<ValuesHarness defaults={{ operator: "eq" }} />);

        expect(
            screen.getByText("campaigns.create.products.values.label")
        ).toBeInTheDocument();
        expect(screen.queryByText("campaigns.create.products.addValue")).toBe(
            null
        );
    });

    it("reveals the upper-bound field only for `between`", () => {
        const { unmount } = render(
            <ValuesHarness defaults={{ field: "unitPrice", operator: "gte" }} />
        );
        expect(
            screen.queryByText("campaigns.create.products.valueToLabel")
        ).toBe(null);
        unmount();

        render(
            <ValuesHarness
                defaults={{ field: "unitPrice", operator: "between" }}
            />
        );
        expect(
            screen.getByText("campaigns.create.products.valueToLabel")
        ).toBeInTheDocument();
    });

    it("adds a row for a list operator", () => {
        const onValues = vi.fn();
        render(
            <ValuesHarness
                defaults={{ operator: "in", values: ["A"] }}
                onValues={onValues}
            />
        );

        fireEvent.click(screen.getByText("campaigns.create.products.addValue"));
        expect(onValues).toHaveBeenCalledWith(["A", ""]);
    });

    it("removes the right row, and hides delete on the last one", () => {
        const onValues = vi.fn();
        const { unmount } = render(
            <ValuesHarness
                defaults={{ operator: "in", values: ["A", "B", "C"] }}
                onValues={onValues}
            />
        );

        const removes = screen.getAllByLabelText(
            "campaigns.create.products.removeValue"
        );
        expect(removes).toHaveLength(3);
        fireEvent.click(removes[1]);
        expect(onValues).toHaveBeenCalledWith(["A", "C"]);
        unmount();

        // A lone row can't be removed — an empty list is not a scope.
        render(<ValuesHarness defaults={{ operator: "in", values: ["A"] }} />);
        expect(
            screen.queryByLabelText("campaigns.create.products.removeValue")
        ).toBe(null);
    });
});

describe("AdvancedScopeNotice", () => {
    it("lists a nested scope read-only", () => {
        render(
            <AdvancedScopeNotice
                productScope={{
                    logic: "none",
                    conditions: [
                        { field: "sku", operator: "eq", value: "CHEAP" },
                    ],
                }}
            />
        );

        expect(
            screen.getByText("campaigns.create.products.advanced")
        ).toBeInTheDocument();
        expect(screen.getByText("sku eq")).toBeInTheDocument();
    });
});
