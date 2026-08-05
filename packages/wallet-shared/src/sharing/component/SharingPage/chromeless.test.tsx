import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { containerChromeless } from "../shared.css";
import { SharingPage, type SharingPageProps } from "./index";

// Echo keys back so assertions read against stable identifiers rather than
// translated copy. Step copy is given period-free stand-ins: the component
// splits a step at its first period into title + description, which would
// otherwise carve up the dotted key itself.
const STEP_TEXT: Record<string, string> = {
    "sdk.sharingPage.steps.1": "step one",
    "sdk.sharingPage.steps.2": "step two",
    "sdk.sharingPage.steps.3": "step three",
};

const t = (key: string) => STEP_TEXT[key] ?? key;

function renderPage(overrides: Partial<SharingPageProps> = {}) {
    const onDismiss = vi.fn();
    const onShare = vi.fn();
    const onCopy = vi.fn();

    const { container } = render(
        <SharingPage
            appName="Acme"
            products={[]}
            sharingLink="https://example.com/share"
            installUrl="/install?m=1&a=2"
            t={t}
            isSharing={false}
            showConfirmation={false}
            onShare={onShare}
            onCopy={onCopy}
            onDismiss={onDismiss}
            onShareAgain={vi.fn()}
            onInstall={vi.fn()}
            onConfirmationDismiss={vi.fn()}
            {...overrides}
        />
    );

    // The backdrop is the component's outermost element; the inner container
    // stops propagation, so this is the only node that reaches the handler.
    const backdrop = container.firstElementChild as HTMLElement;
    const surface = backdrop.firstElementChild as HTMLElement;

    return { onDismiss, onShare, onCopy, backdrop, surface };
}

describe("SharingPage chromeless mode", () => {
    it("renders the header and footer CTAs by default", () => {
        renderPage();

        expect(screen.getByText("sdk.sharingPage.dismiss")).toBeInTheDocument();
        expect(screen.getByText("sharing.btn.share")).toBeInTheDocument();
        expect(screen.getByText("sharing.btn.copy")).toBeInTheDocument();
    });

    it("hides only the header when chromeless, keeping the footer CTAs", () => {
        renderPage({ chromeless: true });

        expect(
            screen.queryByText("sdk.sharingPage.dismiss")
        ).not.toBeInTheDocument();
        expect(screen.getByText("sharing.btn.share")).toBeInTheDocument();
        expect(screen.getByText("sharing.btn.copy")).toBeInTheDocument();
    });

    it("still hides the share CTA when the platform cannot share", () => {
        renderPage({ chromeless: true, canShare: false });

        expect(screen.queryByText("sharing.btn.share")).not.toBeInTheDocument();
        expect(screen.getByText("sharing.btn.copy")).toBeInTheDocument();
    });

    it("reports chromeless footer presses through the same callbacks", () => {
        const { onShare, onCopy } = renderPage({ chromeless: true });

        fireEvent.click(screen.getByText("sharing.btn.share"));
        fireEvent.click(screen.getByText("sharing.btn.copy"));

        expect(onShare).toHaveBeenCalled();
        expect(onCopy).toHaveBeenCalled();
    });

    it("keeps the page content when chromeless", () => {
        renderPage({ chromeless: true });

        // The host replaces the chrome, not the page itself: the how-it-works
        // stepper still renders.
        expect(screen.getByText("step one")).toBeInTheDocument();
    });

    it("dismisses on backdrop click by default", () => {
        const { onDismiss, backdrop } = renderPage();

        fireEvent.click(backdrop);

        expect(onDismiss).toHaveBeenCalled();
    });

    it("does not dismiss on backdrop click when chromeless", () => {
        const { onDismiss, backdrop } = renderPage({ chromeless: true });

        fireEvent.click(backdrop);

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("drops the tablet card treatment when chromeless", () => {
        const { surface } = renderPage({ chromeless: true });

        expect(surface).toHaveClass(containerChromeless);
    });

    it("keeps the tablet card treatment by default", () => {
        const { surface } = renderPage();

        expect(surface).not.toHaveClass(containerChromeless);
    });

    it("puts the top corner radii on the container when chromeless with a hostCornerRadius", () => {
        const { surface } = renderPage({
            chromeless: true,
            hostCornerRadius: 28,
        });

        expect(surface.style.borderTopLeftRadius).toBe("28px");
        expect(surface.style.borderTopRightRadius).toBe("28px");
    });

    it("leaves no inline radius when chromeless without a hostCornerRadius", () => {
        const { surface } = renderPage({ chromeless: true });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });

    it("leaves no inline radius when hostCornerRadius is set but chromeless is false", () => {
        const { surface } = renderPage({
            chromeless: false,
            hostCornerRadius: 28,
        });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });
});
