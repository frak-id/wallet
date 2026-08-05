import { render } from "@testing-library/react";
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
            appName="Acme"
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
        const { surface } = renderConfirmation({ chromeless: true });

        expect(surface).toHaveClass(containerChromeless);
    });

    it("puts the top corner radii on the container when chromeless with a hostCornerRadius", () => {
        const { surface } = renderConfirmation({
            chromeless: true,
            hostCornerRadius: 28,
        });

        expect(surface.style.borderTopLeftRadius).toBe("28px");
        expect(surface.style.borderTopRightRadius).toBe("28px");
    });

    it("leaves no inline radius when chromeless without a hostCornerRadius", () => {
        const { surface } = renderConfirmation({ chromeless: true });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });

    it("leaves no inline radius when hostCornerRadius is set but chromeless is false", () => {
        const { surface } = renderConfirmation({
            chromeless: false,
            hostCornerRadius: 28,
        });

        expect(surface.style.borderTopLeftRadius).toBe("");
        expect(surface.style.borderTopRightRadius).toBe("");
    });
});
