import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareButtonPreview } from "./index";

function renderButton(style?: React.CSSProperties) {
    render(
        <ShareButtonPreview
            text="Share and earn"
            currency="eur"
            shopName="Nowa"
            style={style}
        />
    );
    return screen.getByTestId("share-button-preview");
}

describe("ShareButtonPreview", () => {
    it("applies every style control to the previewed button", () => {
        const button = renderButton({
            background: "#ffffff",
            color: "#000000",
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: "#112233",
            fontSize: "12px",
            paddingTop: "10px",
            paddingBottom: "10px",
            paddingLeft: "24px",
            paddingRight: "24px",
            marginTop: "4px",
            marginBottom: "8px",
        });

        expect(button).toHaveStyle({
            color: "rgb(0, 0, 0)",
            borderStyle: "solid",
            borderWidth: "1px",
            fontSize: "12px",
            paddingTop: "10px",
            paddingLeft: "24px",
            marginTop: "4px",
            marginBottom: "8px",
        });
    });

    it("renders no background but keeps the border when transparent is set", () => {
        const button = renderButton({
            background: "transparent",
            borderStyle: "solid",
            borderWidth: "1px",
        });

        expect(button).toHaveStyle({
            background: "transparent",
            borderWidth: "1px",
        });
    });

    it("leaves the default styling untouched when no control is set", () => {
        const button = renderButton({});
        expect(button.hasAttribute("style")).toBe(false);
    });

    it("leaves the default styling untouched when no style is passed", () => {
        const button = renderButton();
        expect(button.hasAttribute("style")).toBe(false);
    });

    it("still renders the button wording", () => {
        const button = renderButton({ fontSize: "12px" });
        expect(button).toHaveTextContent("Share and earn");
    });
});
