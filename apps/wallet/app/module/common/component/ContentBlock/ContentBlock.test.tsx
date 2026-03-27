import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentBlock } from "./index";
import * as styles from "./index.css";

describe("ContentBlock", () => {
    it("should use xs text spacing by default", () => {
        render(
            <ContentBlock
                icon={<span data-testid="icon">i</span>}
                title="Title"
                description="Description"
            />
        );

        const title = screen.getByText("Title");
        const textContainer = title.parentElement;

        expect(textContainer).toHaveClass(styles.text.xs);
    });

    it("should use m text spacing when requested", () => {
        render(
            <ContentBlock
                icon={<span data-testid="icon">i</span>}
                title="Title"
                description="Description"
                textSpacing="m"
            />
        );

        const title = screen.getByText("Title");
        const textContainer = title.parentElement;

        expect(textContainer).toHaveClass(styles.text.m);
    });
});
