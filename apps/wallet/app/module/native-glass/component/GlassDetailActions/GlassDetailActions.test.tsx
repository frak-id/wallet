import { BANNER_STACK_ATTRIBUTE } from "@frak-labs/design-system/components/BannerStack";
import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailOverlay } from "@/module/common/component/DetailOverlay";
import { initNativeGlass } from "../../bridge";
import { GlassDetailActions } from "./index";

const { invokeMock, addPluginListenerMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    addPluginListenerMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
    addPluginListener: addPluginListenerMock,
}));

vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("@frak-labs/app-essentials/utils/platform")
    >()),
    IS_IOS: true,
}));

async function probeNativeGlass(supported: boolean) {
    invokeMock.mockImplementation(async (command: string) =>
        command.endsWith("|is_supported") ? { supported } : undefined
    );
    await initNativeGlass();
}

let emit: (event: { toolbarId: string; itemId: string }) => void = () => {};

function toolbarCalls() {
    return invokeMock.mock.calls
        .filter(([command]) => command === "plugin:frak-glass|set_toolbar")
        .map(([, args]) => args);
}

function lastToolbar() {
    return toolbarCalls().at(-1);
}

async function flushBridge() {
    await act(async () => {});
}

describe("GlassDetailActions", () => {
    beforeEach(async () => {
        invokeMock.mockReset();
        await probeNativeGlass(true);
        addPluginListenerMock
            .mockReset()
            .mockImplementation(async (_plugin, _event, handler) => {
                emit = handler;
                return { unregister: vi.fn() };
            });
    });

    afterEach(() => {
        document.body.removeAttribute("data-scroll-locked");
        document.querySelector(`[${BANNER_STACK_ATTRIBUTE}]`)?.remove();
    });

    it("renders the web glass buttons off iOS 26", async () => {
        await probeNativeGlass(false);
        render(
            <GlassDetailActions
                id="sheet"
                onClose={vi.fn()}
                closeLabel="Close"
                onShare={vi.fn()}
                shareLabel="Share"
            />
        );

        expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
        expect(lastToolbar()).toBeUndefined();
    });

    it("mirrors close and share into a visible native toolbar", async () => {
        render(
            <GlassDetailActions
                id="sheet"
                onClose={vi.fn()}
                closeLabel="Close"
                onShare={vi.fn()}
                shareLabel="Share"
            />
        );
        await flushBridge();

        expect(screen.queryByRole("button")).toBeNull();
        expect(lastToolbar()).toEqual({
            id: "sheet",
            offsetTop: 0,
            leading: [{ id: "close", icon: "glass-close", label: "Close" }],
            trailing: [{ id: "share", icon: "glass-share", label: "Share" }],
            visible: true,
        });
    });

    it("drops the share button when there is nothing to share", async () => {
        render(<GlassDetailActions id="sheet" onClose={vi.fn()} />);
        await flushBridge();

        expect(lastToolbar()?.trailing).toEqual([]);
    });

    it("routes native taps for its own toolbar only", async () => {
        const onClose = vi.fn();
        const onShare = vi.fn();
        render(
            <GlassDetailActions
                id="sheet"
                onClose={onClose}
                onShare={onShare}
            />
        );
        await flushBridge();

        act(() => emit({ toolbarId: "other", itemId: "close" }));
        expect(onClose).not.toHaveBeenCalled();

        act(() => emit({ toolbarId: "sheet", itemId: "share" }));
        act(() => emit({ toolbarId: "sheet", itemId: "close" }));
        expect(onShare).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("hides while a Radix overlay is open on top", async () => {
        render(<GlassDetailActions id="sheet" onClose={vi.fn()} />);
        await flushBridge();

        document.body.setAttribute("data-scroll-locked", "1");
        await flushBridge();
        expect(lastToolbar()?.visible).toBe(false);
    });

    it("hides as soon as the sheet starts closing", async () => {
        render(
            <DetailOverlay
                onClose={vi.fn()}
                labelKey="wallet.modal.explorerDetail.ariaLabel"
            >
                {({ handleClose }) => (
                    <GlassDetailActions id="sheet" onClose={handleClose} />
                )}
            </DetailOverlay>
        );
        await flushBridge();
        expect(lastToolbar()?.visible).toBe(true);

        act(() => emit({ toolbarId: "sheet", itemId: "close" }));
        await flushBridge();
        expect(lastToolbar()?.visible).toBe(false);
    });

    it("reaches native once for a StrictMode mount", async () => {
        render(
            <StrictMode>
                <GlassDetailActions id="sheet" onClose={vi.fn()} />
            </StrictMode>
        );
        await flushBridge();

        expect(toolbarCalls()).toHaveLength(1);
        expect(lastToolbar()?.visible).toBe(true);
    });

    it("stays shown across an unmount and remount in one commit", async () => {
        const { rerender } = render(
            <GlassDetailActions key="a" id="sheet" onClose={vi.fn()} />
        );
        await flushBridge();

        rerender(<GlassDetailActions key="b" id="sheet" onClose={vi.fn()} />);
        await flushBridge();

        expect(toolbarCalls()).toHaveLength(2);
        expect(lastToolbar()?.visible).toBe(true);
    });

    it("steps aside while a top banner shows", async () => {
        const stack = document.createElement("div");
        stack.setAttribute(BANNER_STACK_ATTRIBUTE, "");
        document.body.append(stack);
        render(<GlassDetailActions id="sheet" onClose={vi.fn()} />);
        await flushBridge();
        expect(lastToolbar()?.visible).toBe(true);

        stack.append(document.createElement("div"));
        await flushBridge();
        expect(lastToolbar()?.visible).toBe(false);
    });

    it("keeps the web buttons in the large-iPad card layout", async () => {
        const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
            (query) =>
                ({
                    matches: query === "(min-width: 1024px)",
                    media: query,
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                }) as unknown as MediaQueryList
        );
        try {
            render(
                <GlassDetailActions
                    id="sheet"
                    onClose={vi.fn()}
                    closeLabel="Close"
                />
            );
            await flushBridge();

            expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
            expect(lastToolbar()).toBeUndefined();
        } finally {
            matchMedia.mockRestore();
        }
    });

    it("hides on unmount", async () => {
        const { unmount } = render(
            <GlassDetailActions id="sheet" onClose={vi.fn()} />
        );
        await flushBridge();

        unmount();
        await flushBridge();
        expect(lastToolbar()?.visible).toBe(false);
    });
});
