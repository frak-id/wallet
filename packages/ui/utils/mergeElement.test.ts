/**
 * Tests for mergeElement utility function
 * Tests React element prop merging functionality
 */

import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";
import { mergeElement } from "./mergeElement";

describe("mergeElement", () => {
    describe("valid React elements", () => {
        it("should merge props into existing element", () => {
            const element = createElement("div", { id: "original" });
            const merged = mergeElement(element, { className: "new-class" });

            expect(merged).not.toBe(element); // Should be cloned
            expect(merged).toHaveProperty("props");
            if (merged && typeof merged === "object" && "props" in merged) {
                const props = merged.props as Record<string, unknown>;
                expect(props).toHaveProperty("id", "original");
                expect(props).toHaveProperty("className", "new-class");
            }
        });

        it("should override existing props", () => {
            const element = createElement("div", { id: "original" });
            const merged = mergeElement(element, { id: "new-id" });

            if (merged && typeof merged === "object" && "props" in merged) {
                const props = merged.props as Record<string, unknown>;
                expect(props).toHaveProperty("id", "new-id");
            }
        });

        it("should merge multiple props", () => {
            const element = createElement("div", { id: "original" });
            const merged = mergeElement(element, {
                className: "test",
                "data-testid": "test-id",
            });

            if (merged && typeof merged === "object" && "props" in merged) {
                const props = merged.props as Record<string, unknown>;
                expect(props).toHaveProperty("id", "original");
                expect(props).toHaveProperty("className", "test");
                expect(props).toHaveProperty("data-testid", "test-id");
            }
        });

        it("should preserve element type", () => {
            const element = createElement("span", {});
            const merged = mergeElement(element, { className: "test" });

            if (merged && typeof merged === "object" && "type" in merged) {
                expect(merged.type).toBe("span");
            }
        });

        it("should work with custom components", () => {
            const CustomComponent = (props: {
                id: string;
                className?: string;
            }) => createElement("div", props);

            const element = createElement(CustomComponent, { id: "original" });
            const merged = mergeElement(element, { className: "new-class" });

            expect(merged).not.toBe(element);
            if (merged && typeof merged === "object" && "props" in merged) {
                const props = merged.props as Record<string, unknown>;
                expect(props).toHaveProperty("id", "original");
                expect(props).toHaveProperty("className", "new-class");
            }
        });

        it("should handle empty props object", () => {
            const element = createElement("div", { id: "test" });
            const merged = mergeElement(element, {});

            expect(merged).not.toBe(element);
            if (merged && typeof merged === "object" && "props" in merged) {
                const props = merged.props as Record<string, unknown>;
                expect(props).toHaveProperty("id", "test");
            }
        });
    });

    describe("non-React elements", () => {
        it("should return string as-is", () => {
            const result = mergeElement("string", { className: "test" });

            expect(result).toBe("string");
        });

        it("should return number as-is", () => {
            const result = mergeElement(123, { className: "test" });

            expect(result).toBe(123);
        });

        it("should return null as-is", () => {
            const result = mergeElement(null, { className: "test" });

            expect(result).toBeNull();
        });

        it("should return undefined as-is", () => {
            const result = mergeElement(undefined, { className: "test" });

            expect(result).toBeUndefined();
        });

        it("should return boolean as-is", () => {
            const result = mergeElement(true, { className: "test" });

            expect(result).toBe(true);
        });

        it("should return array as-is", () => {
            const array = [createElement("div"), createElement("span")];
            const result = mergeElement(array, { className: "test" });

            expect(result).toBe(array);
        });

        it("should return fragment as-is", () => {
            const fragment = createElement(Fragment, null, "child");
            const result = mergeElement(fragment, { className: "test" });

            // Fragments can't have props merged, but function should handle gracefully
            expect(result).toBeDefined();
        });
    });

    describe("edge cases", () => {
        it("should handle element with children", () => {
            const element = createElement("div", { id: "test" }, "child");
            const merged = mergeElement(element, { className: "new-class" });

            if (merged && typeof merged === "object" && "props" in merged) {
                const props = merged.props as Record<string, unknown>;
                expect(props).toHaveProperty("id", "test");
                expect(props).toHaveProperty("className", "new-class");
                expect(props.children).toBe("child");
            }
        });

        it("should handle style props (cloneElement replaces, not merges)", () => {
            const element = createElement("div", {
                style: { color: "red" },
            });
            const merged = mergeElement(element, {
                style: { backgroundColor: "blue" },
            });

            if (merged && typeof merged === "object" && "props" in merged) {
                const props = merged.props as Record<string, unknown>;
                const style = props.style as
                    | Record<string, unknown>
                    | undefined;
                // React.cloneElement replaces props, doesn't deep merge
                // So style will only have backgroundColor
                expect(style).toHaveProperty("backgroundColor", "blue");
                // color is replaced, not merged
                expect(style).not.toHaveProperty("color");
            }
        });
    });
});
