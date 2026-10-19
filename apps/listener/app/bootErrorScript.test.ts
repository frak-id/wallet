import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";

describe("index.html boot-error script", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");

    beforeAll(() => {
        new Function(inlineScript)();
    });

    afterEach(() => {
        postMessage.mockReset();
        document.head.replaceChildren();
    });

    it("reports a script that throws", () => {
        window.dispatchEvent(
            new ErrorEvent("error", { message: "Uncaught TypeError: boom" })
        );

        expect(postMessage).toHaveBeenCalledWith(
            {
                iframeLifecycle: "boot-error",
                data: { message: "Uncaught TypeError: boom" },
            },
            "*"
        );
    });

    it("reports a script that fails to load", () => {
        const script = document.createElement("script");
        script.src = "https://wallet.frak.id/listener/assets/index-abc.js";
        document.head.append(script);

        script.dispatchEvent(new Event("error"));

        expect(postMessage).toHaveBeenCalledWith(
            {
                iframeLifecycle: "boot-error",
                data: {
                    message:
                        "Failed to load https://wallet.frak.id/listener/assets/index-abc.js",
                },
            },
            "*"
        );
    });

    it("reports a modulepreload that fails to load", () => {
        const link = document.createElement("link");
        link.rel = "modulepreload";
        link.href = "https://wallet.frak.id/listener/assets/common-abc.js";
        document.head.append(link);

        link.dispatchEvent(new Event("error"));

        expect(postMessage).toHaveBeenCalledWith(
            {
                iframeLifecycle: "boot-error",
                data: {
                    message:
                        "Failed to load https://wallet.frak.id/listener/assets/common-abc.js",
                },
            },
            "*"
        );
    });

    it("ignores an image that fails to load", () => {
        const img = document.createElement("img");
        document.head.append(img);

        img.dispatchEvent(new Event("error"));

        expect(postMessage).not.toHaveBeenCalled();
    });
});
