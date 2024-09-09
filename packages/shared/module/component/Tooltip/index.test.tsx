import { screen } from "@testing-library/dom";
import { cleanup, render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { Tooltip } from ".";

afterEach(() => {
    cleanup();
});

describe("<Tooltip />", async () => {
    const tooltipContent = "my tooltip content";
    const tooltipTrigger = "tooltip trigger";

    test("should render component", async () => {
        render(
            <Tooltip content={tooltipContent}>
                <span>{tooltipTrigger}</span>
            </Tooltip>
        );
        await userEvent.hover(screen.getByText(tooltipTrigger));
        expect(screen.getByRole("tooltip")).toHaveTextContent(tooltipContent);
    });

    test("should render children if { hidden={true} }", async () => {
        render(
            <Tooltip content={tooltipContent} hidden={true}>
                <span>{tooltipTrigger}</span>
            </Tooltip>
        );
        screen.getByText(tooltipTrigger, { selector: "span" });
    });
});
