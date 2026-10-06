import { describe, expect, it } from "vitest";
import { isSwipeStart, shouldCommitSwipe } from "./useEdgeSwipeToClose";

const WIDTH = 400;

describe("isSwipeStart", () => {
    const html = (markup: string) => {
        const host = document.createElement("div");
        host.innerHTML = markup;
        return host;
    };

    it("accepts a plain target inside the edge strip", () => {
        expect(isSwipeStart(10, html("<p>text</p>").querySelector("p"))).toBe(
            true
        );
    });

    it("rejects a start outside the edge strip", () => {
        expect(isSwipeStart(200, html("<p>text</p>").querySelector("p"))).toBe(
            false
        );
    });

    it.each([
        ["button", "<button><span>go</span></button>", "span"],
        ["link", "<a href='#'><span>go</span></a>", "span"],
        ["role=button", "<div role='button'><b>go</b></div>", "b"],
        ["input", "<input />", "input"],
    ])("rejects an interactive control: %s", (_name, markup, selector) => {
        expect(isSwipeStart(10, html(markup).querySelector(selector))).toBe(
            false
        );
    });

    it("rejects a target inside data-owns-horizontal-drag", () => {
        const host = html(
            "<div data-owns-horizontal-drag><img alt='slide' /></div>"
        );
        expect(isSwipeStart(10, host.querySelector("img"))).toBe(false);
    });
});

describe("shouldCommitSwipe", () => {
    it("commits past a third of the width", () => {
        expect(shouldCommitSwipe(WIDTH * 0.4, WIDTH, 600)).toBe(true);
    });

    it("settles back on a short, slow drag", () => {
        expect(shouldCommitSwipe(WIDTH * 0.15, WIDTH, 600)).toBe(false);
    });

    it("commits a short, fast rightward flick", () => {
        expect(shouldCommitSwipe(WIDTH * 0.15, WIDTH, 60)).toBe(true);
    });

    it("ignores a fast twitch below the minimum distance", () => {
        expect(shouldCommitSwipe(8, WIDTH, 5)).toBe(false);
    });

    it("never commits a leftward or zero drag", () => {
        expect(shouldCommitSwipe(0, WIDTH, 10)).toBe(false);
        expect(shouldCommitSwipe(-200, WIDTH, 10)).toBe(false);
    });
});
