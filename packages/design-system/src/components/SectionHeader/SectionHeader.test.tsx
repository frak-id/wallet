import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "./index";

describe("SectionHeader", () => {
    it("should render title text", () => {
        render(<SectionHeader title="History" />);
        expect(screen.getByText("History")).toBeInTheDocument();
    });
});
