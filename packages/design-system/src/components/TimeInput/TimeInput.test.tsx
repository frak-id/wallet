import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimeInput } from "./index";

describe("TimeInput", () => {
    it("should render a native time input", () => {
        render(<TimeInput aria-label="Start time" />);
        const input = screen.getByLabelText("Start time");
        expect(input).toHaveAttribute("type", "time");
    });

    it("should render the clock icon", () => {
        const { container } = render(<TimeInput aria-label="Start time" />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("should forward the value prop", () => {
        render(
            <TimeInput
                aria-label="Start time"
                value="09:30"
                onChange={() => {}}
            />
        );
        expect(screen.getByLabelText("Start time")).toHaveValue("09:30");
    });

    it("should forward the disabled prop", () => {
        render(<TimeInput aria-label="Start time" disabled />);
        expect(screen.getByLabelText("Start time")).toBeDisabled();
    });
});
