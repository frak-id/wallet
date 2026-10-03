import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { NativeTabBar } from "./index";

const { invokeMock, addPluginListenerMock, navigateMock, preloadRouteMock } =
    vi.hoisted(() => ({
        invokeMock: vi.fn(),
        addPluginListenerMock: vi.fn(),
        navigateMock: vi.fn(),
        preloadRouteMock: vi.fn(),
    }));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
    addPluginListener: addPluginListenerMock,
}));

vi.mock("@tanstack/react-router", async () => ({
    ...(await vi.importActual("@tanstack/react-router")),
    useRouter: () => ({
        navigate: navigateMock,
        preloadRoute: preloadRouteMock,
    }),
}));

const tabs = [
    { key: "/wallet", label: "Wallet", icon: null, nativeIcon: "tab-wallet" },
    {
        key: "/explorer",
        label: "Explorer",
        icon: null,
        nativeIcon: "tab-explorer",
    },
    {
        key: "/profile",
        label: "Profile",
        icon: null,
        nativeIcon: "tab-profile",
    },
];

let emitTabSelected: (event: { key: string }) => void = () => {};

function updates() {
    return invokeMock.mock.calls
        .filter(([command]) => command === "plugin:frak-glass|set_tab_bar")
        .map(([, args]) => args);
}

function lastUpdate() {
    return updates().at(-1);
}

async function flushBridge() {
    await act(async () => {});
}

describe("NativeTabBar", () => {
    beforeEach(() => {
        invokeMock.mockReset().mockResolvedValue({ height: 83 });
        navigateMock.mockReset();
        preloadRouteMock.mockReset().mockResolvedValue(undefined);
        addPluginListenerMock
            .mockReset()
            .mockImplementation(async (_plugin, _event, handler) => {
                emitTabSelected = handler;
                return { unregister: vi.fn() };
            });
        modalStore.setState({ stack: [], modal: null });
    });

    afterEach(() => {
        document.body.removeAttribute("data-scroll-locked");
        document.documentElement.style.removeProperty(
            "--native-tab-bar-height"
        );
    });

    it("sends the whole bar state in a single update", async () => {
        render(<NativeTabBar tabs={tabs} activeKey="/wallet" />);
        await flushBridge();

        expect(updates()).toHaveLength(1);
        expect(lastUpdate()).toEqual({
            items: [
                { key: "/wallet", title: "Wallet", icon: "tab-wallet" },
                { key: "/explorer", title: "Explorer", icon: "tab-explorer" },
                { key: "/profile", title: "Profile", icon: "tab-profile" },
            ],
            selectedKey: "/wallet",
            visible: true,
            tint: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        });
        expect(
            document.documentElement.style.getPropertyValue(
                "--native-tab-bar-height"
            )
        ).toBe("83px");
    });

    it("hides while a store modal is open", async () => {
        render(<NativeTabBar tabs={tabs} activeKey="/wallet" />);
        await flushBridge();

        act(() => modalStore.getState().openModal({ id: "transfer" }));
        await flushBridge();
        expect(lastUpdate()?.visible).toBe(false);

        act(() => modalStore.getState().closeModal());
        await flushBridge();
        expect(lastUpdate()?.visible).toBe(true);
    });

    it("hides while a Radix overlay locks body scroll", async () => {
        render(<NativeTabBar tabs={tabs} activeKey="/wallet" />);
        await flushBridge();

        document.body.setAttribute("data-scroll-locked", "1");
        await flushBridge();
        expect(lastUpdate()?.visible).toBe(false);
    });

    it("hides on unmount", async () => {
        const { unmount } = render(
            <NativeTabBar tabs={tabs} activeKey="/wallet" />
        );
        await flushBridge();

        unmount();
        await flushBridge();
        expect(lastUpdate()?.visible).toBe(false);
    });

    it("navigates with the bottom bar's replace rule", async () => {
        render(
            <NativeTabBar tabs={tabs} activeKey="/wallet" homeKey="/wallet" />
        );
        await flushBridge();

        act(() => emitTabSelected({ key: "/explorer" }));
        expect(navigateMock).toHaveBeenCalledWith({
            to: "/explorer",
            replace: false,
        });
    });

    it("treats a tap on the active tab as a reselect", async () => {
        const onReselect = vi.fn();
        render(
            <NativeTabBar
                tabs={tabs}
                activeKey="/explorer"
                onReselect={onReselect}
            />
        );
        await flushBridge();

        act(() => emitTabSelected({ key: "/explorer" }));
        expect(onReselect).toHaveBeenCalledOnce();
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("ignores a tab tap while an overlay hides the bar", async () => {
        render(<NativeTabBar tabs={tabs} activeKey="/wallet" />);
        await flushBridge();

        act(() => modalStore.getState().openModal({ id: "transfer" }));
        await flushBridge();
        act(() => emitTabSelected({ key: "/explorer" }));
        expect(navigateMock).not.toHaveBeenCalled();

        act(() => modalStore.getState().closeModal());
        await flushBridge();
        act(() => emitTabSelected({ key: "/explorer" }));
        expect(navigateMock).toHaveBeenCalledOnce();
    });

    it("preloads every tab route", async () => {
        render(<NativeTabBar tabs={tabs} activeKey="/wallet" />);
        await flushBridge();

        expect(preloadRouteMock.mock.calls.map(([opts]) => opts.to)).toEqual([
            "/wallet",
            "/explorer",
            "/profile",
        ]);
    });
});
