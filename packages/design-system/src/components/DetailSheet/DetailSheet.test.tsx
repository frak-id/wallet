import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    DetailSheet,
    DetailSheetActions,
    DetailSheetBody,
    DetailSheetFooter,
    DetailSheetHero,
} from ".";

function renderDetailSheet(props?: { heroHeight?: number }) {
    return render(
        <DetailSheet>
            <DetailSheetHero height={props?.heroHeight}>
                <img src="test.jpg" alt="hero" />
                <DetailSheetActions>
                    <button type="button">Action</button>
                </DetailSheetActions>
            </DetailSheetHero>
            <DetailSheetBody>Body content</DetailSheetBody>
            <DetailSheetFooter>Footer content</DetailSheetFooter>
        </DetailSheet>
    );
}

describe("DetailSheet", () => {
    it("should render body content", () => {
        renderDetailSheet();
        expect(screen.getByText("Body content")).toBeTruthy();
    });

    it("should render hero with image content", () => {
        renderDetailSheet();
        expect(screen.getByAltText("hero")).toBeTruthy();
    });

    it("should render actions within hero area", () => {
        renderDetailSheet();
        expect(screen.getByText("Action")).toBeTruthy();
    });

    it("should render footer as last child", () => {
        renderDetailSheet();
        expect(screen.getByText("Footer content")).toBeTruthy();
    });

    it("should render without optional hero, actions, and footer", () => {
        render(
            <DetailSheet>
                <DetailSheetBody>Only body</DetailSheetBody>
            </DetailSheet>
        );
        expect(screen.getByText("Only body")).toBeTruthy();
    });

    it("should forward className to root", () => {
        render(
            <DetailSheet className="custom-detail-sheet">
                <DetailSheetBody>Content</DetailSheetBody>
            </DetailSheet>
        );
        expect(document.querySelector(".custom-detail-sheet")).toBeTruthy();
    });

    it("swaps the root class for the background2 surface", () => {
        const { container, rerender } = render(<DetailSheet>x</DetailSheet>);
        const defaultClass = (container.firstChild as HTMLElement).className;

        rerender(<DetailSheet surface="background2">x</DetailSheet>);
        expect((container.firstChild as HTMLElement).className).not.toBe(
            defaultClass
        );
    });

    it("swaps the hero class for the overlay surface", () => {
        const { container, rerender } = render(<DetailSheetHero />);
        const defaultClass = (container.firstChild as HTMLElement).className;

        rerender(<DetailSheetHero surface="overlay" />);
        expect((container.firstChild as HTMLElement).className).not.toBe(
            defaultClass
        );
    });

    it("should accept height prop on hero", () => {
        renderDetailSheet({ heroHeight: 400 });
        expect(screen.getByAltText("hero")).toBeTruthy();
    });
});
