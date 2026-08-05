import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { containerChromeless } from "../shared.css";
import { SharingPage, type SharingPageProps } from "./index";

// Echo keys back so assertions read against stable identifiers rather than
// translated copy.
const t = (key: string) => key;

function renderPage(overrides: Partial<SharingPageProps> = {}) {
    const onDismiss = vi.fn();
    const onShare = vi.fn();
    const onCopy = vi.fn();

    const { container } = render(
        <SharingPage
            merchant={{ name: "Acme" }}
            view="share"
            chrome={{ mode: "full" }}
            sharingLink="https://example.com/share"
            installUrl="/install?m=1&a=2"
            reward={{ status: "ready" }}
            share={{ canShare: true, isSharing: false }}
            t={t}
            {...overrides}
            actions={{
                onShare,
                onCopy,
                onDismiss,
                onShareAgain: vi.fn(),
                onInstall: vi.fn(),
                onConfirmationDismiss: vi.fn(),
                ...overrides.actions,
            }}
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
        renderPage({ chrome: { mode: "none" } });

        expect(
            screen.queryByText("sdk.sharingPage.dismiss")
        ).not.toBeInTheDocument();
        expect(screen.getByText("sharing.btn.share")).toBeInTheDocument();
        expect(screen.getByText("sharing.btn.copy")).toBeInTheDocument();
    });

    it("still hides the share CTA when the platform cannot share", () => {
        renderPage({
            chrome: { mode: "none" },
            share: { canShare: false, isSharing: false },
        });

        expect(screen.queryByText("sharing.btn.share")).not.toBeInTheDocument();
        expect(screen.getByText("sharing.btn.copy")).toBeInTheDocument();
    });

    it("reports chromeless footer presses through the same callbacks", () => {
        const { onShare, onCopy } = renderPage({ chrome: { mode: "none" } });

        fireEvent.click(screen.getByText("sharing.btn.share"));
        fireEvent.click(screen.getByText("sharing.btn.copy"));

        expect(onShare).toHaveBeenCalled();
        expect(onCopy).toHaveBeenCalled();
    });

    it("keeps the page content when chromeless", () => {
        renderPage({ chrome: { mode: "none" } });

        // The host replaces the chrome, not the page itself: the how-it-works
        // stepper still renders.
        expect(
            screen.getByText("sdk.sharingPage.steps.1.title")
        ).toBeInTheDocument();
    });

    it("dismisses on backdrop click by default", () => {
        const { onDismiss, backdrop } = renderPage();

        fireEvent.click(backdrop);

        expect(onDismiss).toHaveBeenCalled();
    });

    it("does not dismiss on backdrop click when chromeless", () => {
        const { onDismiss, backdrop } = renderPage({
            chrome: { mode: "none" },
        });

        fireEvent.click(backdrop);

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("dismisses on Escape (§3.3 — previously unreachable: the backdrop is not focusable, and the container stopped keydown propagation)", () => {
        const { onDismiss } = renderPage();

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).toHaveBeenCalled();
    });

    it("dismisses on Escape even when the keydown originates inside the container", () => {
        // The old backdrop-level onKeyDown could never see this: the inner
        // container's own onKeyDown called stopPropagation() on every keydown.
        const { onDismiss, surface } = renderPage();

        fireEvent.keyDown(surface, { key: "Escape" });

        expect(onDismiss).toHaveBeenCalled();
    });

    it("does not dismiss on Escape when chromeless — the host owns dismissal", () => {
        const { onDismiss } = renderPage({ chrome: { mode: "none" } });

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("ignores other keys", () => {
        const { onDismiss } = renderPage();

        fireEvent.keyDown(document, { key: "Enter" });

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("marks the container as a dialog", () => {
        const { surface } = renderPage();

        expect(surface).toHaveAttribute("role", "dialog");
        expect(surface).toHaveAttribute("aria-modal", "true");
    });

    it("routes Escape to the confirmation screen's own dismiss handler while it is shown, not this page's", () => {
        // `PostShareConfirmation` (rendered when `showConfirmation` is true)
        // owns an identical Escape effect scoped to `onConfirmationDismiss`.
        // Without gating this page's own effect on `showConfirmation`, both
        // would be live on `document` at once and a single Escape press would
        // fire two, possibly different, callbacks.
        const onDismiss = vi.fn();
        const onConfirmationDismiss = vi.fn();
        renderPage({
            view: "confirmation",
            actions: {
                onShare: vi.fn(),
                onCopy: vi.fn(),
                onDismiss,
                onShareAgain: vi.fn(),
                onInstall: vi.fn(),
                onConfirmationDismiss,
            },
        });

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onConfirmationDismiss).toHaveBeenCalledTimes(1);
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("drops the tablet card treatment when chromeless", () => {
        const { surface } = renderPage({ chrome: { mode: "none" } });

        expect(surface).toHaveClass(containerChromeless);
    });

    it("keeps the tablet card treatment by default", () => {
        const { surface } = renderPage();

        expect(surface).not.toHaveClass(containerChromeless);
    });

    it("puts the top corner radii on the container when chromeless with a hostCornerRadius", () => {
        const { surface } = renderPage({
            chrome: { mode: "none", cornerRadius: 28 },
        });

        expect(surface.style.borderTopLeftRadius).toBe("28px");
        expect(surface.style.borderTopRightRadius).toBe("28px");
    });

    it("leaves no inline radius when chromeless without a hostCornerRadius", () => {
        const { surface } = renderPage({ chrome: { mode: "none" } });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });

    it("cannot express a radius in full-chrome mode at all", () => {
        // `chrome` is a union: `mode: "full"` has nowhere to put a radius, so
        // the invariant that used to be a comment plus a duplicated runtime
        // guard is now a type error instead.
        const { surface } = renderPage({ chrome: { mode: "full" } });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });
});
