import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as styles from "@/module/common/styles/detailOverlay.css";
import { DetailOverlay } from "./index";

// `DetailOverlay` portals straight to `document.body`, which means
// concurrent renders inside the same test file would all share the body
// (vitest's default `concurrent: true`). Walk up from a unique testid in
// the children render-prop so each test grabs its own overlay element.
const renderOverlay = (
    variant: "fullScreen" | "bottomSheet" | undefined,
    onClose = vi.fn(),
    body: React.ReactNode = <div data-testid="overlay-body" />
) => {
    const utils = render(
        <DetailOverlay onClose={onClose} variant={variant}>
            {({ handleClose }) => (
                <div data-testid="overlay-body">
                    <button
                        type="button"
                        data-testid="close-trigger"
                        onClick={handleClose}
                    >
                        close
                    </button>
                    {body}
                </div>
            )}
        </DetailOverlay>
    );
    const overlay = utils.baseElement.querySelector(
        "[data-testid='overlay-body']"
    )?.parentElement as HTMLDivElement;
    return { ...utils, overlay, onClose };
};

describe.sequential("DetailOverlay", () => {
    it("renders the children render-prop", () => {
        const { overlay } = renderOverlay(undefined);
        expect(overlay).toBeTruthy();
        expect(
            overlay.querySelector("[data-testid='overlay-body']")
        ).toBeTruthy();
    });

    it("uses the fullScreen overlay class by default", () => {
        const { overlay } = renderOverlay(undefined);
        expect(overlay.className).toBe(styles.overlay);
    });

    it("uses the bottomSheet overlay class when variant='bottomSheet'", () => {
        const { overlay } = renderOverlay("bottomSheet");
        expect(overlay.className).toBe(styles.bottomSheetOverlay);
    });

    it("flips to the bottomSheet *Closing class when handleClose runs", () => {
        const { overlay, getByTestId } = renderOverlay("bottomSheet");
        fireEvent.click(getByTestId("close-trigger"));
        expect(overlay.className).toBe(styles.bottomSheetClosing);
    });

    it("flips to the fullScreen *Closing class when handleClose runs", () => {
        const { overlay, getByTestId } = renderOverlay(undefined);
        fireEvent.click(getByTestId("close-trigger"));
        expect(overlay.className).toBe(styles.overlayClosing);
    });
});
