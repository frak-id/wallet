import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
    PostShareConfirmation,
    type PostShareConfirmationProps,
} from "./index";

const t = (key: string) => key;
const CTA_KEY = "sdk.sharingPage.confirmation.cta";

function renderConfirmation(
    overrides: Partial<PostShareConfirmationProps> = {}
) {
    render(
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

    return screen.getByRole("button", { name: CTA_KEY });
}

describe("PostShareConfirmation install CTA", () => {
    it("offers the install CTA when an install link exists", () => {
        expect(renderConfirmation()).toBeEnabled();
    });

    it("disables the install CTA only when there is no link at all", () => {
        expect(renderConfirmation({ installUrl: null })).toBeDisabled();
    });

    it("stays enabled for a credential-less merchant-only link", () => {
        // What the wallet's own /sharing page builds with no `a=` and no
        // checkout token: the store CTA behind it is the whole surface.
        const cta = renderConfirmation({ installUrl: "/install?m=merchant-1" });

        expect(cta).toBeEnabled();
    });
});
