import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { containerChromeless } from "../shared.css";
import {
    PostShareConfirmation,
    type PostShareConfirmationProps,
} from "./index";

const t = (key: string) => key;

function renderConfirmation(
    overrides: Partial<PostShareConfirmationProps> = {}
) {
    const { container } = render(
        <PostShareConfirmation
            installUrl="/install?m=1&a=2"
            merchant={{ name: "Acme" }}
            chrome={{ mode: "full" }}
            t={t}
            onDismiss={vi.fn()}
            onShareAgain={vi.fn()}
            onInstall={vi.fn()}
            {...overrides}
        />
    );

    // Same shape as SharingPage's chromeless test: the backdrop is the
    // outermost element, the inner container stops propagation.
    const backdrop = container.firstElementChild as HTMLElement;
    const surface = backdrop.firstElementChild as HTMLElement;

    return { backdrop, surface };
}

describe("PostShareConfirmation chromeless mode", () => {
    it("drops the tablet card treatment when chromeless", () => {
        const { surface } = renderConfirmation({ chrome: { mode: "none" } });

        expect(surface).toHaveClass(containerChromeless);
    });

    it("puts the top corner radii on the container when a host supplies one", () => {
        const { surface } = renderConfirmation({
            chrome: { mode: "none", cornerRadius: 28 },
        });

        expect(surface.style.borderTopLeftRadius).toBe("28px");
        expect(surface.style.borderTopRightRadius).toBe("28px");
    });

    it("leaves no inline radius when the host supplies none", () => {
        const { surface } = renderConfirmation({ chrome: { mode: "none" } });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });

    it("cannot express a radius in full-chrome mode at all", () => {
        const { surface } = renderConfirmation({
            chrome: { mode: "full" },
        });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });

    it("dismisses on Escape (§3.3 — previously unreachable, same bug as SharingPage)", () => {
        const onDismiss = vi.fn();
        renderConfirmation({ onDismiss });

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).toHaveBeenCalled();
    });

    it("dismisses on Escape even when the keydown originates inside the container", () => {
        const onDismiss = vi.fn();
        const { surface } = renderConfirmation({ onDismiss });

        fireEvent.keyDown(surface, { key: "Escape" });

        expect(onDismiss).toHaveBeenCalled();
    });

    it("does not dismiss on Escape when chromeless — the host owns dismissal", () => {
        const onDismiss = vi.fn();
        renderConfirmation({ chrome: { mode: "none" }, onDismiss });

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("marks the container as a dialog", () => {
        const { surface } = renderConfirmation();

        expect(surface).toHaveAttribute("role", "dialog");
        expect(surface).toHaveAttribute("aria-modal", "true");
    });
});
