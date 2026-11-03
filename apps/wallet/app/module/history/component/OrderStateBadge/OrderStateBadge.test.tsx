import { render } from "@testing-library/react";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { OrderStateBadge } from "./index";

describe("OrderStateBadge", () => {
    test.for(["placed", "pending", "rejected"] as const)(
        "a %s order gets a badge",
        (state) => {
            const { container } = render(<OrderStateBadge state={state} />);
            expect(container.firstChild).not.toBeNull();
        }
    );

    test("a processed order gets none", () => {
        const { container } = render(<OrderStateBadge state="processed" />);
        expect(container.firstChild).toBeNull();
    });
});
