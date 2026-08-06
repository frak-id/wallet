import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/fixtures";
import { ListenerSharingPage } from "./index";

// `SharingPage` is stubbed down to surface the one prop under test; everything
// else in this module runs for real.
const emitterMock = vi.hoisted(() => vi.fn());
const clearRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/ui/ListenerUiProvider", () => ({
    useListenerTranslation: () => ({ t: (key: string) => key }),
    useSharingListenerUI: () => ({
        currentRequest: {
            appName: "Acme",
            logoUrl: undefined,
            params: {
                link: "https://acme.example/product",
                products: undefined,
                attribution: undefined,
            },
            emitter: emitterMock,
            targetInteraction: undefined,
            i18n: undefined,
            configMetadata: undefined,
        },
        clearRequest: clearRequestMock,
    }),
}));

vi.mock("@/module/stores/hooks", () => ({
    // No merchantId keeps the reward query disabled, so no backend mock is needed.
    useSafeResolvingContext: () => ({
        sourceUrl: "https://acme.example",
        merchantId: undefined,
        installProof: undefined,
    }),
}));

vi.mock("@/module/stores/resolvingContextStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    const resolvingContextStore = createStore(() => ({
        backendSdkConfig: undefined,
    }));
    return { resolvingContextStore };
});

vi.mock("@/module/hooks/useTrackSharing", () => ({
    useTrackSharing: () => ({ mutate: vi.fn() }),
}));

vi.mock("@frak-labs/wallet-shared/sharing", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/wallet-shared/sharing")
        >();
    return {
        ...actual,
        SharingPage: (props: { share?: { canShare?: boolean } }) => (
            <div
                data-testid="sharing-page"
                data-can-share={String(props.share?.canShare)}
            />
        ),
    };
});

function setNavigatorShare(share: (() => Promise<void>) | undefined) {
    if (share) {
        Object.defineProperty(navigator, "share", {
            value: share,
            configurable: true,
        });
        return;
    }
    Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
    });
}

describe("ListenerSharingPage canShare wiring", () => {
    const originalShare = navigator.share;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        setNavigatorShare(originalShare);
    });

    test("passes canShare through when the platform can share", ({
        queryWrapper,
    }) => {
        setNavigatorShare(vi.fn());
        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });
        expect(screen.getByTestId("sharing-page").dataset.canShare).toBe(
            "true"
        );
    });

    test("passes canShare=false through when the platform cannot share, instead of silently defaulting true", ({
        queryWrapper,
    }) => {
        setNavigatorShare(undefined);
        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });
        expect(screen.getByTestId("sharing-page").dataset.canShare).toBe(
            "false"
        );
    });
});
