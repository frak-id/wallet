import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { ButtonRipple } from ".";

describe("<ButtonRipple />", () => {
    const buttonText = "My test button";

    test("should render component", async () => {
        render(<ButtonRipple>{buttonText}</ButtonRipple>);

        const button = screen.getByRole("button");
        expect(button).toHaveTextContent(buttonText);
        expect(button).toHaveClass("buttonRipple__button");

        // Trigger the ripple effect
        await userEvent.click(button);

        // Click twice to test condition if already exists
        await userEvent.click(button);
    });

    test("should render component with { isLoading={true} }", () => {
        const { container } = render(<ButtonRipple isLoading={true} />);

        // Check if the spinner is present
        const span = container.querySelector("span");
        expect(span).toHaveClass("spinner");
    });
});
