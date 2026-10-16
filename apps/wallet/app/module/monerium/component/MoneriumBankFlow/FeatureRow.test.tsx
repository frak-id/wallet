/** @jsxImportSource react */
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { FeatureList } from "./FeatureRow";

describe("FeatureList", () => {
    test("renders a row per feature", () => {
        render(
            <FeatureList
                features={[
                    { icon: null, title: "Fast", description: "Within a day" },
                    { icon: null, title: "Safe", description: "Regulated" },
                ]}
            />
        );

        expect(screen.getByText("Fast")).toBeTruthy();
        expect(screen.getByText("Within a day")).toBeTruthy();
        expect(screen.getByText("Safe")).toBeTruthy();
    });

    test("renders nothing for an empty list", () => {
        const { container } = render(<FeatureList features={[]} />);
        expect(container.firstChild).toBeNull();
    });
});
