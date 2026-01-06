/**
 * Tests for hasClassName utility function
 * Tests React element type guard for className prop
 */

import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { hasClassName } from "./hasClassName";

describe("hasClassName", () => {
    describe("valid elements with className", () => {
        it("should return true for element with string className", () => {
            const element = createElement("div", { className: "test-class" });

            expect(hasClassName(element)).toBe(true);
        });

        it("should return true for element with multiple classes", () => {
            const element = createElement("div", {
                className: "class1 class2 class3",
            });

            expect(hasClassName(element)).toBe(true);
        });

        it("should return true for element with empty string className", () => {
            const element = createElement("div", { className: "" });

            expect(hasClassName(element)).toBe(true);
        });

        it("should narrow type correctly", () => {
            const element = createElement("div", { className: "test" });

            if (hasClassName(element)) {
                // TypeScript should know className exists and is a string
                expect(typeof element.props.className).toBe("string");
                expect(element.props.className).toBe("test");
            } else {
                throw new Error("Should have className");
            }
        });
    });

    describe("invalid elements", () => {
        it("should return false for element without className", () => {
            const element = createElement("div", { id: "test" });

            expect(hasClassName(element)).toBe(false);
        });

        it("should return false for element with undefined className", () => {
            const element = createElement("div", { className: undefined });

            expect(hasClassName(element)).toBe(false);
        });

        it("should return false for element with null className", () => {
            const element = createElement("div", { className: null });

            expect(hasClassName(element)).toBe(false);
        });

        it("should return false for element with non-string className", () => {
            const element = createElement("div", { className: 123 as any });

            expect(hasClassName(element)).toBe(false);
        });

        it("should return true for object with props.className (type guard limitation)", () => {
            // Note: hasClassName only checks for props.className structure,
            // not if it's a valid React element. This is a type guard limitation.
            const notAnElement = { props: { className: "test" } };

            // The function will return true because it has the required structure
            expect(hasClassName(notAnElement as any)).toBe(true);
        });

        it("should return false for element without props", () => {
            const element = { type: "div" } as any;

            expect(hasClassName(element)).toBe(false);
        });

        it("should return false for element with null props", () => {
            const element = { type: "div", props: null } as any;

            expect(hasClassName(element)).toBe(false);
        });

        it("should return false for element with non-object props", () => {
            const element = { type: "div", props: "not-an-object" } as any;

            expect(hasClassName(element)).toBe(false);
        });

        it("should throw error for primitive values (in operator limitation)", () => {
            // The "in" operator throws on primitives and null
            expect(() => hasClassName("string" as any)).toThrow();
            expect(() => hasClassName(123 as any)).toThrow();
            expect(() => hasClassName(null as any)).toThrow();
            expect(() => hasClassName(undefined as any)).toThrow();
        });
    });

    describe("edge cases", () => {
        it("should handle element with other props and className", () => {
            const element = createElement("div", {
                id: "test",
                className: "my-class",
                "data-test": "value",
            });

            expect(hasClassName(element)).toBe(true);
        });

        it("should handle custom component with className", () => {
            const CustomComponent = ({
                className,
                children,
            }: {
                className: string;
                children?: React.ReactNode;
            }) => createElement("div", { className }, children);

            const element = createElement(
                CustomComponent,
                {
                    className: "custom-class",
                },
                null
            );

            expect(hasClassName(element)).toBe(true);
        });
    });
});
