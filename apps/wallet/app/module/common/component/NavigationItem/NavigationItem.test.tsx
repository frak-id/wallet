import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavigationItem } from "./index";

describe("NavigationItem", () => {
    it("should render nothing when deprecated", () => {
        const { container } = render(
            <NavigationItem url="/test">Link</NavigationItem>
        );

        expect(container.firstChild).toBeNull();
    });
});
