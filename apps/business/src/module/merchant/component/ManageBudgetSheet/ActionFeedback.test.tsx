import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { ActionFeedback } from "./ActionFeedback";

describe("ActionFeedback", () => {
    test("shows the shared pending line by default", () => {
        render(<ActionFeedback isPending isError={false} />);
        expect(screen.getByText("funding.pending")).toBeTruthy();
    });

    test("shows the caller's pending text instead when given", () => {
        render(<ActionFeedback isPending isError={false} pendingText="wait" />);
        expect(screen.getByText("wait")).toBeTruthy();
        expect(screen.queryByText("funding.pending")).toBeNull();
    });

    test("shows the error only once nothing is pending", () => {
        render(<ActionFeedback isError />);
        expect(screen.getByRole("alert").textContent).toBe(
            "funding.errors.action"
        );
    });

    test("renders nothing when idle", () => {
        const { container } = render(<ActionFeedback isError={false} />);
        expect(container.textContent).toBe("");
    });
});
