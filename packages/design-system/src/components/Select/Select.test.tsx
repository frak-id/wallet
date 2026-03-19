import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * jsdom lacks pointer-capture APIs that Radix Select relies on internally.
 */
beforeAll(() => {
    const noop = () => {};
    if (!Element.prototype.hasPointerCapture) {
        Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.setPointerCapture) {
        Element.prototype.setPointerCapture = noop;
    }
    if (!Element.prototype.releasePointerCapture) {
        Element.prototype.releasePointerCapture = noop;
    }
});

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from ".";

function renderSelect(defaultValue?: string) {
    return render(
        <Select defaultValue={defaultValue}>
            <SelectTrigger>
                <SelectValue placeholder="Pick a fruit" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Fruits</SelectLabel>
                    <SelectItem value="apple">Apple</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="cherry">Cherry</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                    <SelectLabel>Vegetables</SelectLabel>
                    <SelectItem value="carrot">Carrot</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

function renderOpenSelect() {
    return render(
        <Select open defaultValue="banana">
            <SelectTrigger>
                <SelectValue placeholder="Pick a fruit" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Fruits</SelectLabel>
                    <SelectItem value="apple">Apple</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="cherry">Cherry</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

describe("Select", () => {
    it("should render trigger with placeholder", () => {
        renderSelect();
        expect(screen.getByRole("combobox")).toBeTruthy();
        expect(screen.getByText("Pick a fruit")).toBeTruthy();
    });

    it("should render with a default value", () => {
        renderSelect("banana");
        expect(screen.getByRole("combobox")).toBeTruthy();
        expect(screen.getByText("Banana")).toBeTruthy();
    });

    it("should show listbox when open", () => {
        renderOpenSelect();
        expect(screen.getByRole("listbox")).toBeTruthy();
    });

    it("should display items when open", () => {
        renderOpenSelect();
        expect(screen.getByRole("option", { name: "Apple" })).toBeTruthy();
        expect(screen.getByRole("option", { name: "Cherry" })).toBeTruthy();
    });

    it("should accept length variant on trigger", () => {
        render(
            <Select>
                <SelectTrigger length="big">
                    <SelectValue placeholder="Full width" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="a">A</SelectItem>
                </SelectContent>
            </Select>
        );
        expect(screen.getByRole("combobox")).toBeTruthy();
    });

    it("should accept medium length variant", () => {
        render(
            <Select>
                <SelectTrigger length="medium">
                    <SelectValue placeholder="Medium width" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="a">A</SelectItem>
                </SelectContent>
            </Select>
        );
        expect(screen.getByRole("combobox")).toBeTruthy();
    });

    it("should forward className to trigger", () => {
        render(
            <Select>
                <SelectTrigger className="custom-trigger">
                    <SelectValue placeholder="Styled" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="a">A</SelectItem>
                </SelectContent>
            </Select>
        );
        expect(
            screen.getByRole("combobox").classList.contains("custom-trigger")
        ).toBe(true);
    });

    it("should export all compound parts", () => {
        expect(Select).toBeDefined();
        expect(SelectTrigger).toBeDefined();
        expect(SelectContent).toBeDefined();
        expect(SelectItem).toBeDefined();
        expect(SelectValue).toBeDefined();
        expect(SelectGroup).toBeDefined();
        expect(SelectLabel).toBeDefined();
        expect(SelectSeparator).toBeDefined();
    });
});
