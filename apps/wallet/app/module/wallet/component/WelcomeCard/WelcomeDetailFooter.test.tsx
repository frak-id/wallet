import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailOverlay } from "@/module/common/component/DetailOverlay";
import { initNativeGlass } from "@/module/native-glass/bridge";
import { useNativeBottomAction } from "@/module/native-glass/hook/useNativeBottomAction";
import { WelcomeDetail } from "./WelcomeDetail";

const {
    invokeMock,
    addPluginListenerMock,
    isIosMock,
    navigateMock,
    preloadRouteMock,
} = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    addPluginListenerMock: vi.fn(),
    isIosMock: { value: true },
    navigateMock: vi.fn(),
    preloadRouteMock: vi.fn(),
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

vi.mock("@tanstack/react-router", async () => ({
    ...(await vi.importActual("@tanstack/react-router")),
    useNavigate: () => navigateMock,
    useRouter: () => ({ preloadRoute: preloadRouteMock }),
}));

vi.mock("@/module/common/component/ButtonLink", () => ({
    ButtonLink: ({
        to,
        onClick,
        children,
    }: {
        to: string;
        onClick: () => void;
        children: ReactNode;
    }) => (
        <a
            href={to}
            onClick={(event) => {
                event.preventDefault();
                onClick();
            }}
        >
            {children}
        </a>
    ),
}));

vi.mock("react-i18next", async () => ({
    ...(await vi.importActual("react-i18next")),
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

const DISCOVER_OFFERS = "wallet.welcome.detail.discoverOffers";
const LEGAL = "wallet.welcome.detail.legal";

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

async function probeNativeGlass(supported: boolean) {
    isIosMock.value = supported;
    await initNativeGlass();
}

function renderDetail(detail: ReactNode) {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>{detail}</QueryClientProvider>
    );
}

function legalCaption() {
    return screen.getByText(LEGAL);
}

function IconAction() {
    useNativeBottomAction({
        title: "other",
        icon: "glass-coins",
        visible: true,
        onPress: () => {},
    });
    return null;
}

describe("WelcomeDetail footer", () => {
    beforeEach(async () => {
        invokeMock.mockReset().mockImplementation(async (command: string) => {
            if (command.endsWith("|is_supported")) return { supported: true };
            if (command.endsWith("|set_bottom_action")) return { height: 90 };
            return undefined;
        });
        addPluginListenerMock
            .mockReset()
            .mockImplementation(async (_plugin, event, handler) => {
                if (event === "bottomAction") press = handler;
                return { unregister: vi.fn() };
            });
        navigateMock.mockReset();
        preloadRouteMock.mockReset().mockResolvedValue(undefined);
        await probeNativeGlass(true);
    });

    afterEach(() => {
        document.body.removeAttribute("data-scroll-locked");
    });

    it("keeps the web link and legal in the footer off iOS 26", async () => {
        await probeNativeGlass(false);
        const onClose = vi.fn();
        renderDetail(<WelcomeDetail onClose={onClose} />);
        await flushBridge();

        const link = screen.getByRole("link", { name: DISCOVER_OFFERS });
        expect(link).toHaveAttribute("href", "/explorer");
        expect(link.parentElement).toContainElement(legalCaption());
        fireEvent.click(link);
        expect(onClose).toHaveBeenCalledOnce();
        expect(lastAction()).toBeUndefined();
    });

    it("keeps the web footer in the large-iPad card layout", async () => {
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
            renderDetail(<WelcomeDetail onClose={vi.fn()} />);
            await flushBridge();

            const link = screen.getByRole("link", { name: DISCOVER_OFFERS });
            expect(link.parentElement).toContainElement(legalCaption());
            expect(lastAction()).toBeUndefined();
        } finally {
            matchMedia.mockRestore();
        }
    });

    it("shows the CTA as a native prominent glass button with legal in the body", async () => {
        renderDetail(<WelcomeDetail onClose={vi.fn()} />);
        await flushBridge();

        expect(
            screen.queryByRole("link", { name: DISCOVER_OFFERS })
        ).toBeNull();
        expect(lastAction()).toMatchObject({
            title: DISCOVER_OFFERS,
            visible: true,
        });
        expect(legalCaption().parentElement).toHaveTextContent(
            "wallet.welcome.detail.howItWorks"
        );
        expect(preloadRouteMock).toHaveBeenCalledWith({ to: "/explorer" });
    });

    it("drops the icon a previous bottom action left behind", async () => {
        const previous = renderDetail(<IconAction />);
        await flushBridge();
        expect(lastAction()?.icon).toBe("glass-coins");
        previous.unmount();

        renderDetail(<WelcomeDetail onClose={vi.fn()} />);
        await flushBridge();
        expect(lastAction()).toMatchObject({
            title: DISCOVER_OFFERS,
            visible: true,
        });
        expect(lastAction()?.icon).toBeUndefined();
    });

    it("closes and navigates to the explorer on a native press", async () => {
        const onClose = vi.fn();
        renderDetail(<WelcomeDetail onClose={onClose} />);
        await flushBridge();

        act(() => press());
        expect(onClose).toHaveBeenCalledOnce();
        expect(navigateMock).toHaveBeenCalledWith({ to: "/explorer" });
    });

    it("hides and ignores presses while a Radix overlay locks body scroll", async () => {
        const onClose = vi.fn();
        renderDetail(<WelcomeDetail onClose={onClose} />);
        await flushBridge();

        document.body.setAttribute("data-scroll-locked", "1");
        await flushBridge();
        expect(lastAction()?.visible).toBe(false);

        act(() => press());
        expect(onClose).not.toHaveBeenCalled();
        expect(navigateMock).not.toHaveBeenCalled();

        document.body.removeAttribute("data-scroll-locked");
        await flushBridge();
        expect(lastAction()?.visible).toBe(true);
        act(() => press());
        expect(onClose).toHaveBeenCalledOnce();
        expect(navigateMock).toHaveBeenCalledWith({ to: "/explorer" });
    });

    it("hides and ignores presses once the detail overlay starts closing", async () => {
        const onClose = vi.fn();
        renderDetail(
            <DetailOverlay
                onClose={vi.fn()}
                labelKey="wallet.modal.welcomeDetail.ariaLabel"
            >
                {() => <WelcomeDetail onClose={onClose} />}
            </DetailOverlay>
        );
        await flushBridge();
        expect(lastAction()?.visible).toBe(true);
        act(() => press());
        expect(onClose).toHaveBeenCalledOnce();
        expect(navigateMock).toHaveBeenCalledOnce();

        fireEvent.keyDown(document, { key: "Escape" });
        await flushBridge();
        expect(lastAction()?.visible).toBe(false);

        act(() => press());
        expect(onClose).toHaveBeenCalledOnce();
        expect(navigateMock).toHaveBeenCalledOnce();
    });

    it("hides on unmount", async () => {
        const { unmount } = renderDetail(<WelcomeDetail onClose={vi.fn()} />);
        await flushBridge();

        unmount();
        await flushBridge();
        expect(lastAction()?.visible).toBe(false);
    });
});
