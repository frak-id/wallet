import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as styles from "@/module/common/styles/detailOverlay.css";
import { DetailOverlay, useDetailOverlayLeaving } from "./index";

const platform = vi.hoisted(() => ({ isIos: true }));
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    IS_TAURI: true,
    get IS_IOS() {
        return platform.isIos;
    },
}));

// `DetailOverlay` portals straight to `document.body`, which means
// renders inside the same test file all share the body. Walk up from a
// unique testid in the children render-prop so each test grabs its own
// overlay element.
const renderOverlay = (
    variant: "fullScreen" | "bottomSheet" | undefined,
    onClose = vi.fn(),
    body: React.ReactNode = <div data-testid="overlay-body" />,
    swipeToClose?: boolean
) => {
    const utils = render(
        <DetailOverlay
            onClose={onClose}
            variant={variant}
            swipeToClose={swipeToClose}
            labelKey="wallet.modal.explorerDetail.ariaLabel"
        >
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

describe("DetailOverlay", () => {
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

function LeavingProbe() {
    return <p data-testid="leaving">{String(useDetailOverlayLeaving())}</p>;
}

describe("DetailOverlay swipe to close", () => {
    const WIDTH = 400;

    class StubPointerEvent extends MouseEvent {
        pointerId = 1;
        private readonly at: number;
        constructor(type: string, init: MouseEventInit & { at: number }) {
            super(type, { bubbles: true, ...init });
            this.at = init.at;
        }
        get timeStamp() {
            return this.at;
        }
    }

    const pointer = (
        target: Element,
        type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
        x: number,
        at: number
    ) =>
        act(() => {
            target.dispatchEvent(
                new StubPointerEvent(type, { clientX: x, at })
            );
        });

    const slideDone = (overlay: Element) =>
        overlay.dispatchEvent(
            Object.assign(new Event("transitionend", { bubbles: true }), {
                propertyName: "transform",
            })
        );

    const renderSwipeable = (swipeToClose = true) => {
        const onClose = vi.fn();
        const onInnerClick = vi.fn();
        const utils = renderOverlay(
            undefined,
            onClose,
            <div>
                <button
                    type="button"
                    data-testid="inner"
                    onClick={onInnerClick}
                >
                    inner
                </button>
                <div data-owns-horizontal-drag>
                    <p data-testid="carousel">carousel</p>
                </div>
                <p data-testid="plain">plain</p>
                <LeavingProbe />
            </div>,
            swipeToClose
        );
        Object.defineProperty(utils.overlay, "offsetWidth", { value: WIDTH });
        return { ...utils, onInnerClick };
    };

    const drag = (target: Element, from: number, to: number, ms: number) => {
        pointer(target, "pointerdown", from, 0);
        pointer(target, "pointermove", to, ms);
        return () => pointer(target, "pointerup", to, ms);
    };

    beforeEach(() => {
        platform.isIos = true;
    });

    it("slides out then closes once after a drag past a third of the width", () => {
        const { overlay, onClose, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 170, 400)();
        expect(overlay.style.transform).toBe("translateX(100%)");
        expect(onClose).not.toHaveBeenCalled();
        slideDone(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes once even when the slide's transitionend never arrives", () => {
        vi.useFakeTimers();
        try {
            const { overlay, onClose, getByTestId } = renderSwipeable();
            drag(getByTestId("plain"), 10, 170, 400)();
            vi.advanceTimersByTime(1000);
            expect(onClose).toHaveBeenCalledTimes(1);
            slideDone(overlay);
            expect(onClose).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("follows the finger while dragging", () => {
        const { overlay, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 70, 100);
        expect(overlay.style.transform).toBe("translateX(60px)");
    });

    it("settles back without closing after a short, slow drag", () => {
        const { overlay, onClose, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 70, 600)();
        slideDone(overlay);
        expect(overlay.style.transform).toBe("");
        expect(onClose).not.toHaveBeenCalled();
    });

    it("commits a short, fast flick", () => {
        const { overlay, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 70, 60)();
        expect(overlay.style.transform).toBe("translateX(100%)");
    });

    it("ignores a drag that starts away from the edge", () => {
        const { overlay, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 200, 380, 100)();
        expect(overlay.style.transform).toBe("");
    });

    it("ignores a drag on a button and keeps its click", () => {
        const { overlay, onInnerClick, getByTestId } = renderSwipeable();
        drag(getByTestId("inner"), 10, 300, 100)();
        fireEvent.click(getByTestId("inner"));
        expect(overlay.style.transform).toBe("");
        expect(onInnerClick).toHaveBeenCalledTimes(1);
    });

    it("ignores a drag inside data-owns-horizontal-drag", () => {
        const { overlay, getByTestId } = renderSwipeable();
        drag(getByTestId("carousel"), 10, 300, 100)();
        expect(overlay.style.transform).toBe("");
    });

    it("resets on pointercancel without closing", () => {
        const { overlay, onClose, getByTestId } = renderSwipeable();
        const plain = getByTestId("plain");
        drag(plain, 10, 150, 100);
        pointer(plain, "pointercancel", 150, 110);
        slideDone(overlay);
        expect(overlay.style.transform).toBe("");
        expect(onClose).not.toHaveBeenCalled();
    });

    it("resets when the page goes to the background mid-drag", () => {
        const { overlay, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 150, 100);
        vi.spyOn(document, "hidden", "get").mockReturnValueOnce(true);
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        slideDone(overlay);
        expect(overlay.style.transform).toBe("");
    });

    it("closes once when Escape follows a committed swipe", () => {
        const { overlay, onClose, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 170, 400)();
        fireEvent.keyDown(document, { key: "Escape" });
        slideDone(overlay);
        overlay.dispatchEvent(new Event("animationend"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes immediately on commit under reduced motion", () => {
        vi.mocked(window.matchMedia).mockReturnValueOnce({
            matches: true,
        } as MediaQueryList);
        const { onClose, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 170, 400)();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does nothing without the swipeToClose prop", () => {
        const { overlay, getByTestId } = renderSwipeable(false);
        drag(getByTestId("plain"), 10, 170, 400)();
        expect(overlay.style.transform).toBe("");
    });

    it("reports leaving once the drag moves, and not after it settles back", () => {
        const { getByTestId } = renderSwipeable();
        const plain = getByTestId("plain");
        pointer(plain, "pointerdown", 10, 0);
        pointer(plain, "pointermove", 14, 10);
        expect(getByTestId("leaving").textContent).toBe("false");

        pointer(plain, "pointermove", 70, 100);
        expect(getByTestId("leaving").textContent).toBe("true");

        pointer(plain, "pointerup", 70, 600);
        expect(getByTestId("leaving").textContent).toBe("false");
    });

    it("keeps reporting leaving through a committed slide-out", () => {
        const { getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 170, 400)();
        expect(getByTestId("leaving").textContent).toBe("true");
    });

    it("does nothing when not on iOS", () => {
        platform.isIos = false;
        const { overlay, getByTestId } = renderSwipeable();
        drag(getByTestId("plain"), 10, 170, 400)();
        expect(overlay.style.transform).toBe("");
    });
});
