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

    // the inner container stops propagation, so only the backdrop reaches the handler
    const backdrop = container.firstElementChild as HTMLElement;
    const surface = backdrop.firstElementChild as HTMLElement;

    return { backdrop, surface };
}

describe("PostShareConfirmation chromeless mode", () => {
    it("drops the tablet card treatment when chromeless", () => {
        const { surface } = renderConfirmation({ chrome: { mode: "none" } });

        expect(surface).toHaveClass(containerChromeless);
    });

    it("never inlines a radius, whatever the chrome mode", () => {
        // the host radius arrives as a CSS custom property, never as a prop
        for (const chrome of [{ mode: "none" }, { mode: "full" }] as const) {
            const { surface } = renderConfirmation({ chrome });

            expect(surface.style.borderTopLeftRadius).toBe("");
            expect(surface.style.borderTopRightRadius).toBe("");
        }
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
