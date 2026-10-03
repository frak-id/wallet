import { ua } from "@frak-labs/wallet-shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailOverlay } from "@/module/common/component/DetailOverlay";
import { initNativeGlass } from "@/module/native-glass/bridge";
import { ExplorerDetailFooter, type ExplorerDetailFooterProps } from "./Footer";

const { invokeMock, addPluginListenerMock, isIosMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    addPluginListenerMock: vi.fn(),
    isIosMock: { value: true },
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
    addPluginListener: addPluginListenerMock,
}));

vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("@frak-labs/app-essentials/utils/platform")
    >()),
    get IS_IOS() {
        return isIosMock.value;
    },
}));

let press: () => void = () => {};

function lastAction() {
    return invokeMock.mock.calls
        .filter(
            ([command]) => command === "plugin:frak-glass|set_bottom_action"
        )
        .at(-1)?.[1];
}

async function flushBridge() {
    await act(async () => {});
}

function props(
    overrides: Partial<ExplorerDetailFooterProps> = {}
): ExplorerDetailFooterProps {
    return {
        needsLink: false,
        creating: false,
        createDisabled: false,
        createError: false,
        onCreate: vi.fn(),
        onShare: vi.fn(),
        copied: false,
        onCopy: vi.fn(),
        ...overrides,
    };
}

async function probeNativeGlass(supported: boolean) {
    isIosMock.value = supported;
    await initNativeGlass();
}

describe("ExplorerDetailFooter", () => {
    beforeEach(async () => {
        invokeMock.mockReset().mockImplementation(async (command: string) => {
            if (command.endsWith("|is_supported")) return { supported: true };
            if (command.endsWith("|set_bottom_action")) return { height: 90 };
            return undefined;
        });
        addPluginListenerMock
            .mockReset()
            .mockImplementation(async (_plugin, _event, handler) => {
                press = handler;
                return { unregister: vi.fn() };
            });
        await probeNativeGlass(true);
    });

    afterEach(() => {
        document.body.removeAttribute("data-scroll-locked");
    });

    it("keeps the web CTA off iOS 26", async () => {
        await probeNativeGlass(false);
        const onShare = vi.fn();
        render(<ExplorerDetailFooter {...props({ onShare })} />);

        fireEvent.click(
            screen.getByRole("button", { name: "explorer.detail.shareAndEarn" })
        );
        expect(onShare).toHaveBeenCalledOnce();
        expect(lastAction()).toBeUndefined();
    });

    it("keeps the web CTA in the large-iPad card layout", async () => {
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
            render(<ExplorerDetailFooter {...props()} />);
            await flushBridge();

            expect(
                screen.getByRole("button", {
                    name: "explorer.detail.shareAndEarn",
                })
            ).toBeVisible();
            expect(lastAction()).toBeUndefined();
        } finally {
            matchMedia.mockRestore();
        }
    });

    it("shows the share step as a native prominent glass button", async () => {
        render(<ExplorerDetailFooter {...props()} />);
        await flushBridge();

        expect(screen.queryByRole("button")).toBeNull();
        expect(lastAction()).toMatchObject({
            icon: "glass-coins",
            enabled: true,
            loading: false,
            visible: true,
        });
        expect(
            document.documentElement.style.getPropertyValue(
                "--native-bottom-action-height"
            )
        ).toBe("90px");
    });

    it("routes a native press to the current step", async () => {
        const onCreate = vi.fn();
        const onShare = vi.fn();
        const { rerender } = render(
            <ExplorerDetailFooter
                {...props({ needsLink: true, onCreate, onShare })}
            />
        );
        await flushBridge();

        act(() => press());
        expect(onCreate).toHaveBeenCalledOnce();

        rerender(<ExplorerDetailFooter {...props({ onCreate, onShare })} />);
        act(() => press());
        expect(onShare).toHaveBeenCalledOnce();
    });

    it("spins while the link is being created", async () => {
        render(
            <ExplorerDetailFooter
                {...props({ needsLink: true, creating: true })}
            />
        );
        await flushBridge();

        expect(lastAction()).toMatchObject({ loading: true });
    });

    it("disables the create step when it cannot run", async () => {
        render(
            <ExplorerDetailFooter
                {...props({ needsLink: true, createDisabled: true })}
            />
        );
        await flushBridge();

        expect(lastAction()).toMatchObject({ enabled: false });
    });

    it("keeps the creation error on the web side", async () => {
        render(<ExplorerDetailFooter {...props({ createError: true })} />);
        await flushBridge();

        expect(
            screen.getByText("explorer.detail.createShareLinkError")
        ).toBeVisible();
    });

    it("hides on unmount", async () => {
        const { unmount } = render(<ExplorerDetailFooter {...props()} />);
        await flushBridge();

        unmount();
        await flushBridge();
        expect(lastAction()?.visible).toBe(false);
    });

    it("titles the native button after the current step", async () => {
        const { rerender } = render(
            <ExplorerDetailFooter {...props({ needsLink: true })} />
        );
        await flushBridge();
        expect(lastAction()?.title).toBe("explorer.detail.createShareLink");

        rerender(
            <ExplorerDetailFooter
                {...props({ needsLink: true, creating: true })}
            />
        );
        await flushBridge();
        expect(lastAction()?.title).toBe("explorer.detail.creatingShareLink");

        rerender(<ExplorerDetailFooter {...props()} />);
        await flushBridge();
        expect(lastAction()?.title).toBe("explorer.detail.shareAndEarn");
    });

    it("hides and ignores presses once the detail overlay starts closing", async () => {
        const onShare = vi.fn();
        render(
            <DetailOverlay
                onClose={vi.fn()}
                labelKey="wallet.modal.explorerDetail.ariaLabel"
            >
                {() => <ExplorerDetailFooter {...props({ onShare })} />}
            </DetailOverlay>
        );
        await flushBridge();
        expect(lastAction()?.visible).toBe(true);
        act(() => press());
        expect(onShare).toHaveBeenCalledOnce();

        fireEvent.keyDown(document, { key: "Escape" });
        await flushBridge();
        expect(lastAction()?.visible).toBe(false);

        act(() => press());
        expect(onShare).toHaveBeenCalledOnce();
    });

    it("hides and ignores presses while a Radix overlay locks body scroll", async () => {
        const onShare = vi.fn();
        render(<ExplorerDetailFooter {...props({ onShare })} />);
        await flushBridge();

        document.body.setAttribute("data-scroll-locked", "1");
        await flushBridge();
        expect(lastAction()?.visible).toBe(false);

        act(() => press());
        expect(onShare).not.toHaveBeenCalled();

        document.body.removeAttribute("data-scroll-locked");
        await flushBridge();
        expect(lastAction()?.visible).toBe(true);
        act(() => press());
        expect(onShare).toHaveBeenCalledOnce();
    });

    it("ignores a native press on the create step while creation is disabled", async () => {
        const onCreate = vi.fn();
        const onShare = vi.fn();
        const { rerender } = render(
            <ExplorerDetailFooter
                {...props({
                    needsLink: true,
                    createDisabled: true,
                    onCreate,
                    onShare,
                })}
            />
        );
        await flushBridge();

        act(() => press());
        expect(onCreate).not.toHaveBeenCalled();
        expect(onShare).not.toHaveBeenCalled();

        rerender(
            <ExplorerDetailFooter
                {...props({ needsLink: true, onCreate, onShare })}
            />
        );
        act(() => press());
        expect(onCreate).toHaveBeenCalledOnce();
    });
});

describe("ExplorerDetailFooter web fallback", () => {
    const isMobile = ua.isMobile;

    beforeEach(async () => {
        invokeMock.mockReset().mockResolvedValue(undefined);
        await probeNativeGlass(false);
        ua.isMobile = false;
    });

    afterEach(() => {
        ua.isMobile = isMobile;
    });

    it("labels the create step and disables it when creation cannot run", () => {
        const { rerender } = render(
            <ExplorerDetailFooter
                {...props({ needsLink: true, createDisabled: true })}
            />
        );
        expect(
            screen.getByRole("button", {
                name: "explorer.detail.createShareLink",
            })
        ).toBeDisabled();

        rerender(
            <ExplorerDetailFooter
                {...props({ needsLink: true, creating: true })}
            />
        );
        expect(
            screen.getByRole("button", {
                name: "explorer.detail.creatingShareLink",
            })
        ).toBeEnabled();
        expect(lastAction()).toBeUndefined();
    });

    it("routes the primary button to create on step 1 and to share on step 2", () => {
        const onCreate = vi.fn();
        const onShare = vi.fn();
        const { rerender } = render(
            <ExplorerDetailFooter
                {...props({ needsLink: true, onCreate, onShare })}
            />
        );
        fireEvent.click(
            screen.getByRole("button", {
                name: "explorer.detail.createShareLink",
            })
        );
        expect(onCreate).toHaveBeenCalledOnce();
        expect(onShare).not.toHaveBeenCalled();

        rerender(<ExplorerDetailFooter {...props({ onCreate, onShare })} />);
        fireEvent.click(
            screen.getByRole("button", {
                name: "explorer.detail.shareAndEarn",
            })
        );
        expect(onShare).toHaveBeenCalledOnce();
        expect(onCreate).toHaveBeenCalledOnce();
    });

    it("offers the copy button on desktop once the link exists", () => {
        const onCopy = vi.fn();
        render(<ExplorerDetailFooter {...props({ onCopy })} />);

        fireEvent.click(
            screen.getByRole("button", { name: "sharing.btn.copy" })
        );
        expect(onCopy).toHaveBeenCalledOnce();
    });

    it("hides the copy button on the create step", () => {
        render(<ExplorerDetailFooter {...props({ needsLink: true })} />);

        expect(
            screen.queryByRole("button", { name: "sharing.btn.copy" })
        ).toBeNull();
    });

    it("hides the copy button on mobile", () => {
        ua.isMobile = true;
        render(<ExplorerDetailFooter {...props()} />);

        expect(
            screen.queryByRole("button", { name: "sharing.btn.copy" })
        ).toBeNull();
    });

    it("confirms the copy in the copy button label", () => {
        render(<ExplorerDetailFooter {...props({ copied: true })} />);

        expect(
            screen.getByRole("button", { name: "sharing.btn.copySuccess" })
        ).toBeVisible();
        expect(
            screen.queryByRole("button", { name: "sharing.btn.copy" })
        ).toBeNull();
    });
});
