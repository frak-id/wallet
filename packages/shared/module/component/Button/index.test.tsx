import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Button } from ".";

describe("<Button />", () => {
    const buttonText = "My test button";

    test("should render component", () => {
        render(<Button>{buttonText}</Button>);
        expect(screen.getByRole("button")).toHaveTextContent(buttonText);
    });

    test("should render component with { isLoading={true} }", () => {
        const { container } = render(<Button isLoading={true} />);

        // Check if the spinner is present
        const span = container.querySelector("span");
        expect(span).toHaveClass("spinner");
    });
});
