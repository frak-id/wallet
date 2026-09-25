import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmbassadorHeroPreview, ShareButtonPreview } from "./index";

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

describe("AmbassadorHeroPreview", () => {
    const props = {
        title: "Join {BRAND}",
        lede: "Earn {REWARD} per sale",
        ctaLabel: "Become an ambassador",
        eyebrow: "Ambassador program",
        rewardCaption: "for you, on every sale",
        caption: "No form, no waiting.",
        currency: "eur" as const,
        shopName: "Nowa",
    };

    it("draws the photo with the reward card over it", () => {
        const { container } = render(
            <AmbassadorHeroPreview
                {...props}
                imageUrl="https://cdn.example.com/hero.jpg"
            />
        );
        expect(container.querySelector("img")).toHaveAttribute(
            "src",
            "https://cdn.example.com/hero.jpg"
        );
        expect(screen.getByText("for you, on every sale")).toBeInTheDocument();
    });

    it("keeps the reward card without a photo", () => {
        const { container } = render(<AmbassadorHeroPreview {...props} />);
        expect(container.querySelector("img")).toBeNull();
        expect(screen.getByText("for you, on every sale")).toBeInTheDocument();
    });

    it("fills the brand and the sample amount", () => {
        render(<AmbassadorHeroPreview {...props} />);
        expect(screen.getByText("Join Nowa")).toBeInTheDocument();
        expect(screen.getByText(/^Earn 42.€ per sale$/)).toBeInTheDocument();
    });

    it("shows the label above the headline and the caption under the button", () => {
        render(<AmbassadorHeroPreview {...props} />);
        expect(screen.getByText("Ambassador program")).toBeInTheDocument();
        expect(screen.getByText("No form, no waiting.")).toBeInTheDocument();
    });
});
