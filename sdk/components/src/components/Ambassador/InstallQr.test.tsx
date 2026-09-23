import { render, screen, waitFor } from "@testing-library/preact";
import type { QrOpts } from "qr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstallQr } from "./InstallQr";

const qrMock = vi.hoisted(() => ({
    factoryRuns: 0,
    calls: [] as Array<{ text: string; output: string }>,
    actual: null as typeof import("qr") | null,
    fakeGrid: [
        [true, false, true, false, true],
        [false, true, false, true, false],
        [true, false, false, false, true],
        [false, true, false, true, false],
        [true, false, true, false, true],
    ],
}));

vi.mock("qr", () => {
    qrMock.factoryRuns += 1;
    return {
        encodeQR: (text: string, output: string, opts?: QrOpts) => {
            qrMock.calls.push({ text, output });
            if (qrMock.actual && output === "raw") {
                return qrMock.actual.encodeQR(text, output, opts);
            }
            return qrMock.fakeGrid;
        },
    };
});

const LABEL = "Install the Frak wallet";
const CAPTION = "Scan to install";
const URL_WITH_FRAGMENT = `https://wallet.frak.id/install.html?campaign=summer-referral-2026&ambassador=rodolphe${"&source=store-block&locale=en&theme=auto&ref=".padEnd(200, "x")}#p=${"AwqdBase64ReferralPayload".padEnd(96, "Z")}`;

type MatchMediaControl = {
    queries: string[];
    setMatches: (matches: boolean) => void;
    addCount: () => number;
    removeCount: () => number;
};

function installMatchMedia(initialMatches: boolean): MatchMediaControl {
    let matches = initialMatches;
    let addCount = 0;
    let removeCount = 0;
    const queries: string[] = [];
    const listeners = new Set<(event: { matches: boolean }) => void>();
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => {
            queries.push(query);
            return {
                get matches() {
                    return matches;
                },
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: (
                    _type: string,
                    listener: (event: { matches: boolean }) => void
                ) => {
                    addCount += 1;
                    listeners.add(listener);
                },
                removeEventListener: (
                    _type: string,
                    listener: (event: { matches: boolean }) => void
                ) => {
                    removeCount += 1;
                    listeners.delete(listener);
                },
                dispatchEvent: () => true,
            };
        },
    });
    return {
        queries,
        setMatches: (next: boolean) => {
            matches = next;
            for (const listener of listeners) {
                listener({ matches: next });
            }
        },
        addCount: () => addCount,
        removeCount: () => removeCount,
    };
}

beforeEach(() => {
    qrMock.calls.length = 0;
    qrMock.actual = null;
});

describe("InstallQr", () => {
    it("Covers AE6: a narrow screen renders nothing and never imports the encoder", async () => {
        const media = installMatchMedia(false);
        const { container } = render(
            <InstallQr
                url={URL_WITH_FRAGMENT}
                label={LABEL}
                caption={CAPTION}
            />
        );
        await waitFor(() => expect(media.addCount()).toBe(1));
        expect(container.firstChild).toBeNull();
        expect(screen.queryByRole("img")).toBeNull();
        expect(qrMock.factoryRuns).toBe(0);
        expect(qrMock.calls).toHaveLength(0);
    });

    it("Covers AE6: a wide screen with a url renders an SVG QR with its label and caption", async () => {
        const media = installMatchMedia(true);
        render(
            <InstallQr
                url={URL_WITH_FRAGMENT}
                label={LABEL}
                caption={CAPTION}
            />
        );
        const image = await screen.findByRole("img", { name: LABEL });
        expect(image.tagName.toLowerCase()).toBe("svg");
        expect(image.getAttribute("width")).toBe("200");
        expect(image.getAttribute("height")).toBe("200");
        expect(media.queries).toContain("(min-width: 768px)");
        expect(screen.getByText(CAPTION)).toBeVisible();
    });

    it("renders nothing on a wide screen when no url is given", async () => {
        const media = installMatchMedia(true);
        const loadsBefore = qrMock.factoryRuns;
        render(<InstallQr label={LABEL} caption={CAPTION} />);
        await waitFor(() => expect(media.addCount()).toBe(1));
        expect(screen.queryByRole("img")).toBeNull();
        expect(qrMock.factoryRuns).toBe(loadsBefore);
        expect(qrMock.calls).toHaveLength(0);
    });

    it("stays unfocusable and paints literal black on white despite --frak-amb-accent", async () => {
        installMatchMedia(true);
        document.body.style.setProperty("--frak-amb-accent", "#ff0000");
        render(
            <InstallQr
                url={URL_WITH_FRAGMENT}
                label={LABEL}
                caption={CAPTION}
            />
        );
        const image = await screen.findByRole("img", { name: LABEL });
        expect(image.getAttribute("tabindex")).toBeNull();
        expect(image.getAttribute("focusable")).toBe("false");
        expect(image.querySelector("path")?.getAttribute("fill")).toBe("#000");
        expect(image.querySelector("rect")?.getAttribute("fill")).toBe("#fff");
        expect(image.outerHTML).not.toContain("frak-amb-accent");
        document.body.style.removeProperty("--frak-amb-accent");
    });

    it("mounts the QR when the media query flips narrow to wide without remounting", async () => {
        const media = installMatchMedia(false);
        render(
            <>
                <span data-testid="anchor">anchor</span>
                <InstallQr
                    url={URL_WITH_FRAGMENT}
                    label={LABEL}
                    caption={CAPTION}
                />
            </>
        );
        await waitFor(() => expect(media.addCount()).toBe(1));
        expect(screen.queryByRole("img")).toBeNull();
        const anchor = screen.getByTestId("anchor");

        media.setMatches(true);

        expect(
            await screen.findByRole("img", { name: LABEL })
        ).toBeInTheDocument();
        expect(screen.getByTestId("anchor")).toBe(anchor);
        expect(media.addCount()).toBe(1);
        expect(media.removeCount()).toBe(0);
        expect(qrMock.calls).toHaveLength(1);
    });

    it("passes the url to the encoder verbatim, fragment included", async () => {
        installMatchMedia(true);
        render(
            <InstallQr
                url={URL_WITH_FRAGMENT}
                label={LABEL}
                caption={CAPTION}
            />
        );
        await screen.findByRole("img", { name: LABEL });
        expect(qrMock.calls).toHaveLength(1);
        expect(qrMock.calls[0].text).toBe(URL_WITH_FRAGMENT);
        expect(qrMock.calls[0].output).toBe("raw");
    });

    it("never encodes after unmounting while the encoder loads", async () => {
        installMatchMedia(true);
        const { unmount } = render(
            <InstallQr
                url={URL_WITH_FRAGMENT}
                label={LABEL}
                caption={CAPTION}
            />
        );
        unmount();

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(qrMock.calls).toHaveLength(0);
    });

    it("renders nothing when the environment has no matchMedia", () => {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: undefined,
        });
        const loadsBefore = qrMock.factoryRuns;
        const { container } = render(
            <InstallQr
                url={URL_WITH_FRAGMENT}
                label={LABEL}
                caption={CAPTION}
            />
        );
        expect(container.firstChild).toBeNull();
        expect(screen.queryByRole("img")).toBeNull();
        expect(qrMock.factoryRuns).toBe(loadsBefore);
        expect(qrMock.calls).toHaveLength(0);
    });
});

describe("InstallQr with the real encoder", () => {
    it("renders the real grid square with its quiet zone inside the viewBox", async () => {
        const real = await vi.importActual<typeof import("qr")>("qr");
        qrMock.actual = real;

        const grid = real.encodeQR(URL_WITH_FRAGMENT, "raw", { border: 4 });
        expect(grid.length).toBe(grid[0].length);
        const edge = grid.length;
        for (let ring = 0; ring < 4; ring++) {
            expect(grid[ring].every((cell) => !cell)).toBe(true);
            expect(grid[edge - 1 - ring].every((cell) => !cell)).toBe(true);
            expect(grid.every((row) => !row[ring])).toBe(true);
            expect(grid.every((row) => !row[edge - 1 - ring])).toBe(true);
        }

        installMatchMedia(true);
        render(
            <InstallQr
                url={URL_WITH_FRAGMENT}
                label={LABEL}
                caption={CAPTION}
            />
        );
        const image = await screen.findByRole("img", { name: LABEL });
        expect(image.getAttribute("viewBox")).toBe(`0 0 ${edge} ${edge}`);
        expect(qrMock.calls.at(-1)?.text).toBe(URL_WITH_FRAGMENT);
    });
});
