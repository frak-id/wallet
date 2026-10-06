import { BANNER_STACK_ATTRIBUTE } from "@frak-labs/design-system/components/BannerStack";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    DEFAULT_EXPLORER_SORT,
    EXPLORER_SORT_OPTIONS,
    explorerSortStore,
} from "@/module/explorer/stores/explorerSortStore";
import { initNativeGlass } from "@/module/native-glass/bridge";
import { modalStore } from "@/module/stores/modalStore";
import { ExplorerSortButton } from "./index";

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

let emit: (event: {
    toolbarId: string;
    itemId: string;
    value?: string;
}) => void = () => {};

function sortItem() {
    return invokeMock.mock.calls
        .filter(([command]) => command === "plugin:frak-glass|set_toolbar")
        .at(-1)?.[1];
}

async function flushBridge() {
    await act(async () => {});
}

describe("ExplorerSortButton on iOS 26", () => {
    beforeEach(async () => {
        invokeMock
            .mockReset()
            .mockImplementation(async (command: string) =>
                command.endsWith("|is_supported")
                    ? { supported: true }
                    : undefined
            );
        await initNativeGlass();
        addPluginListenerMock
            .mockReset()
            .mockImplementation(async (_plugin, _event, handler) => {
                emit = handler;
                return { unregister: vi.fn() };
            });
        explorerSortStore.setState({ sort: DEFAULT_EXPLORER_SORT });
        modalStore.setState({ stack: [], modal: null });
    });

    afterEach(() => {
        document.querySelector(`[${BANNER_STACK_ATTRIBUTE}]`)?.remove();
        document.body.removeAttribute("data-scroll-locked");
    });

    it("replaces the web button and sheet with a native menu button", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        expect(screen.queryByRole("button")).toBeNull();
        const toolbar = sortItem();
        expect(toolbar).toMatchObject({
            id: "explorer",
            offsetTop: 16,
            visible: true,
        });
        const [item] = toolbar.trailing;
        expect(item).toMatchObject({ id: "sort", icon: "glass-sort" });
        expect(item.badge).toBeUndefined();
        expect(item.menu.selected).toBe(DEFAULT_EXPLORER_SORT);
        expect(item.menu.options).toHaveLength(EXPLORER_SORT_OPTIONS.length);
    });

    it("applies a menu pick straight away and shows the dot", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        act(() =>
            emit({ toolbarId: "explorer", itemId: "sort", value: "reward" })
        );
        await flushBridge();

        expect(explorerSortStore.getState().sort).toBe("reward");
        const [item] = sortItem().trailing;
        expect(item.menu.selected).toBe("reward");
        expect(item.badge).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("ignores a value that is not a sort option", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        act(() =>
            emit({ toolbarId: "explorer", itemId: "sort", value: "bogus" })
        );
        expect(explorerSortStore.getState().sort).toBe(DEFAULT_EXPLORER_SORT);
    });

    it("hides while a modal covers the page", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        act(() => modalStore.getState().openModal({ id: "transfer" }));
        await flushBridge();
        expect(sortItem().visible).toBe(false);
    });

    it("steps aside while a top banner shows", async () => {
        const stack = document.createElement("div");
        stack.setAttribute(BANNER_STACK_ATTRIBUTE, "");
        document.body.append(stack);
        render(<ExplorerSortButton />);
        await flushBridge();
        expect(sortItem().visible).toBe(true);

        stack.append(document.createElement("div"));
        await flushBridge();
        expect(sortItem().visible).toBe(false);

        stack.replaceChildren();
        await flushBridge();
        expect(sortItem().visible).toBe(true);
    });

    it("shows again once the modal closes", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        act(() => modalStore.getState().openModal({ id: "transfer" }));
        await flushBridge();
        act(() => modalStore.getState().closeModal());
        await flushBridge();
        expect(sortItem().visible).toBe(true);
    });

    it("hides while a Radix overlay locks body scroll", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        document.body.setAttribute("data-scroll-locked", "1");
        await flushBridge();
        expect(sortItem().visible).toBe(false);

        document.body.removeAttribute("data-scroll-locked");
        await flushBridge();
        expect(sortItem().visible).toBe(true);
    });

    it("hides on unmount", async () => {
        const { unmount } = render(<ExplorerSortButton />);
        await flushBridge();

        unmount();
        await flushBridge();
        expect(sortItem().visible).toBe(false);
    });

    it("ignores a menu pick for another toolbar", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        act(() =>
            emit({ toolbarId: "sheet", itemId: "sort", value: "reward" })
        );
        expect(explorerSortStore.getState().sort).toBe(DEFAULT_EXPLORER_SORT);

        act(() =>
            emit({ toolbarId: "explorer", itemId: "sort", value: "reward" })
        );
        expect(explorerSortStore.getState().sort).toBe("reward");
    });

    it("announces a custom sort in the button label", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();
        const [defaultItem] = sortItem().trailing;
        expect(defaultItem.label).toBe("explorer.sort.open");

        act(() => explorerSortStore.getState().setSort("reward"));
        await flushBridge();
        const [customItem] = sortItem().trailing;
        expect(customItem.label).not.toBe(defaultItem.label);
        expect(customItem.label).toMatch(/^explorer\.sort\./);
    });

    it("titles the menu and its options with explorer sort keys", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        const [item] = sortItem().trailing;
        expect(item.menu.title).toBe("explorer.sort.title");
        expect(item.menu.options).toEqual(
            EXPLORER_SORT_OPTIONS.map((option) => ({
                value: option.value,
                title: option.labelKey,
            }))
        );
        for (const option of item.menu.options) {
            expect(option.title).toMatch(/^explorer\.sort\./);
        }
    });
});

describe("ExplorerSortButton off iOS 26", () => {
    beforeEach(async () => {
        invokeMock
            .mockReset()
            .mockImplementation(async (command: string) =>
                command.endsWith("|is_supported")
                    ? { supported: false }
                    : undefined
            );
        await initNativeGlass();
        explorerSortStore.setState({ sort: DEFAULT_EXPLORER_SORT });
        modalStore.setState({ stack: [], modal: null });
    });

    it("renders the web button and never reaches the native toolbar", async () => {
        render(<ExplorerSortButton />);
        await flushBridge();

        expect(
            screen.getByRole("button", { name: "explorer.sort.open" })
        ).toBeVisible();
        expect(sortItem()).toBeUndefined();
    });
});
