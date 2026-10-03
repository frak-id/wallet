import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FullScreenGate } from "@/module/common/component/FullScreenGate";
import { ExplorerDetailFooter } from "@/module/explorer/component/ExplorerDetail/Footer";
import { ExplorerSortButton } from "@/module/explorer/component/ExplorerSortButton";
import {
    DEFAULT_EXPLORER_SORT,
    explorerSortStore,
} from "@/module/explorer/stores/explorerSortStore";
import { modalStore } from "@/module/stores/modalStore";
import { SoftUpdatePrompt } from "@/module/version/component/SoftUpdatePrompt";
import { initNativeGlass } from "../bridge";
import { GlassDetailActions } from "../component/GlassDetailActions";
import { NativeTabBar } from "../component/NativeTabBar";

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

vi.mock("@tanstack/react-router", async () => ({
    ...(await vi.importActual("@tanstack/react-router")),
    useRouter: () => ({
        navigate: vi.fn(),
        preloadRoute: vi.fn().mockResolvedValue(undefined),
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
];

const footerProps = {
    needsLink: false,
    creating: false,
    createDisabled: false,
    createError: false,
    onCreate: () => {},
    onShare: () => {},
    copied: false,
    onCopy: () => {},
};

const queryClient = new QueryClient();

function NativeChrome() {
    return (
        <>
            <NativeTabBar tabs={tabs} activeKey="/explorer" />
            <GlassDetailActions id="sheet" onClose={() => {}} />
            <ExplorerSortButton />
            <ExplorerDetailFooter {...footerProps} />
        </>
    );
}

function Screen({
    gates = 0,
    softUpdate = false,
}: {
    gates?: number;
    softUpdate?: boolean;
}) {
    return (
        <QueryClientProvider client={queryClient}>
            <NativeChrome />
            {["lock", "update"].slice(0, gates).map((gate) => (
                <FullScreenGate
                    key={gate}
                    title="Locked"
                    action={<button type="button">Unlock</button>}
                />
            ))}
            {softUpdate && (
                <SoftUpdatePrompt mode="available" onDismiss={() => {}} />
            )}
        </QueryClientProvider>
    );
}

function lastArgs(command: string, toolbarId?: string) {
    return invokeMock.mock.calls
        .filter(
            ([name, args]) =>
                name === `plugin:frak-glass|${command}` &&
                (toolbarId === undefined || args?.id === toolbarId)
        )
        .at(-1)?.[1];
}

function chromeVisibility() {
    return {
        tabBar: lastArgs("set_tab_bar")?.visible,
        detailActions: lastArgs("set_toolbar", "sheet")?.visible,
        sortButton: lastArgs("set_toolbar", "explorer")?.visible,
        detailCta: lastArgs("set_bottom_action")?.visible,
    };
}

const allVisible = {
    tabBar: true,
    detailActions: true,
    sortButton: true,
    detailCta: true,
};

const allHidden = {
    tabBar: false,
    detailActions: false,
    sortButton: false,
    detailCta: false,
};

async function flushBridge() {
    await act(async () => {});
}

describe("useCoverNativeChrome", () => {
    beforeEach(async () => {
        invokeMock.mockReset().mockImplementation(async (command: string) => {
            if (command.endsWith("|is_supported")) return { supported: true };
            if (command.endsWith("|set_tab_bar")) return { height: 83 };
            if (command.endsWith("|set_bottom_action")) return { height: 90 };
            return undefined;
        });
        addPluginListenerMock
            .mockReset()
            .mockResolvedValue({ unregister: vi.fn() });
        await initNativeGlass();
        modalStore.setState({ stack: [], modal: null });
        explorerSortStore.setState({ sort: DEFAULT_EXPLORER_SORT });
    });

    it("hides every native surface while a full-screen gate is mounted and shows them once it unmounts", async () => {
        const { rerender } = render(<Screen />);
        await flushBridge();
        expect(chromeVisibility()).toEqual(allVisible);

        rerender(<Screen gates={1} />);
        await flushBridge();
        expect(chromeVisibility()).toEqual(allHidden);

        rerender(<Screen />);
        await flushBridge();
        expect(chromeVisibility()).toEqual(allVisible);
    });

    it("keeps everything hidden while one of two gates is still mounted", async () => {
        const { rerender } = render(<Screen gates={2} />);
        await flushBridge();
        expect(chromeVisibility()).toEqual(allHidden);

        rerender(<Screen gates={1} />);
        await flushBridge();
        expect(chromeVisibility()).toEqual(allHidden);

        rerender(<Screen />);
        await flushBridge();
        expect(chromeVisibility()).toEqual(allVisible);
    });

    it("hides only the bottom surfaces while a soft update prompt is mounted", async () => {
        const { rerender } = render(<Screen />);
        await flushBridge();

        rerender(<Screen softUpdate />);
        await flushBridge();
        expect(chromeVisibility()).toEqual({
            tabBar: false,
            detailActions: true,
            sortButton: true,
            detailCta: false,
        });

        rerender(<Screen />);
        await flushBridge();
        expect(chromeVisibility()).toEqual(allVisible);
    });
});
