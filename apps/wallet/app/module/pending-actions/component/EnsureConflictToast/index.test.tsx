/** @jsxImportSource react */
import { act, render, screen } from "@testing-library/react";
import { ensureConflictStore } from "@/module/pending-actions/stores/ensureConflictStore";
import { afterEach, describe, expect, test } from "@/tests/vitest-fixtures";
import { EnsureConflictToast } from "./index";

describe("EnsureConflictToast", () => {
    afterEach(() => {
        act(() => {
            ensureConflictStore.getState().dismiss();
        });
    });

    test("renders nothing until a conflict is raised", () => {
        const { container } = render(<EnsureConflictToast />);

        expect(container).toBeEmptyDOMElement();
    });

    test("surfaces the conflict raised by a drained ensure", () => {
        render(<EnsureConflictToast />);

        act(() => {
            ensureConflictStore.getState().raise();
        });

        expect(
            screen.getByText(/pendingActions\.walletAlreadyLinked\.title/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/pendingActions\.walletAlreadyLinked\.message/)
        ).toBeInTheDocument();
    });
});
