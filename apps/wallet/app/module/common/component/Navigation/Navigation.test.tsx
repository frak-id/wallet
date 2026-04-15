import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Navigation } from "./index";

describe("Navigation", () => {
    it("should render nothing when deprecated", () => {
        const { container } = render(<Navigation />);

        expect(container.firstChild).toBeNull();
    });
});
