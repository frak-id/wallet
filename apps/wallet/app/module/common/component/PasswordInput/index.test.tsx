import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./index";

describe("PasswordInput", () => {
    it("names the field by its label and describes it by its hint", () => {
        render(
            <PasswordInput
                value=""
                onChange={vi.fn()}
                toggleLabel="Show password"
                label="Password"
                hint="At least 8 characters."
            />
        );

        expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
            "At least 8 characters."
        );
    });
});
