import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmationTooltip } from ".";

describe("ConfirmationTooltip", () => {
    it("should render the message", () => {
        const { getByText } = render(
            <ConfirmationTooltip>Code applied successfully</ConfirmationTooltip>
        );
        expect(getByText("Code applied successfully")).toBeTruthy();
    });

    it("should expose status role with polite live region", () => {
        const { container } = render(
            <ConfirmationTooltip>Done</ConfirmationTooltip>
        );
        const status = container.querySelector('[role="status"]');
        expect(status).toBeTruthy();
        expect(status?.getAttribute("aria-live")).toBe("polite");
    });

    it("should render the default ProgressCheck icon", () => {
        const { container } = render(
            <ConfirmationTooltip>Done</ConfirmationTooltip>
        );
        expect(container.querySelector("svg")).toBeTruthy();
    });

    it("should allow overriding the icon", () => {
        const { getByTestId, container } = render(
            <ConfirmationTooltip
                icon={<span data-testid="custom-icon">!</span>}
            >
                Done
            </ConfirmationTooltip>
        );
        expect(getByTestId("custom-icon")).toBeTruthy();
        expect(container.querySelector("svg")).toBeFalsy();
    });

    it("should forward className to the pill wrapper", () => {
        const { container } = render(
            <ConfirmationTooltip className="custom-pill">
                Done
            </ConfirmationTooltip>
        );
        expect(container.querySelector(".custom-pill")).toBeTruthy();
    });
});
