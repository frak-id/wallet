import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { ListenerModal } from "./index";

vi.mock("@/module/hooks/useGetMergeToken", () => ({
    useGetMergeToken: () => vi.fn(),
}));

vi.mock("@/module/providers/ListenerUiProvider", () => ({
    useListenerUI: () => ({
        clearRequest: vi.fn(),
    }),
    useListenerTranslation: () => ({
        t: (value: string) => value,
        i18n: {
            exists: () => false,
        },
    }),
}));

vi.mock("@/module/stores/modalStore", () => {
    const state = {
        results: {},
        steps: [],
    };

    const store = Object.assign(
        (selector?: (storeState: typeof state) => unknown) =>
            selector ? selector(state) : state,
        {
            getState: () => state,
        }
    );

    return {
        modalStore: store,
        selectCurrentStep: () => null,
        selectCurrentStepObject: () => null,
        selectIsDismissed: () => false,
        selectShouldFinish: () => null,
    };
});

vi.mock("@/module/stores/resolvingContextStore", () => ({
    resolvingContextStore: (
        selector: (state: { context: { sourceUrl: string } }) => unknown
    ) =>
        selector({
            context: {
                sourceUrl: "https://example.com",
            },
        }),
}));

vi.mock("@frak-labs/ui/hook/useMediaQuery", () => ({
    useMediaQuery: () => true,
}));

vi.mock("@frak-labs/ui/icons/LogoFrakWithName", () => ({
    LogoFrakWithName: ({ className }: { className?: string }) => (
        <span className={className}>frak-logo</span>
    ),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DrawerContent: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    InAppBrowserToast: () => null,
    OriginPairingState: () => <div>origin-pairing</div>,
    WalletModal: ({ title, text }: { title: ReactNode; text: ReactNode }) => (
        <div>
            <div>{title}</div>
            <div>{text}</div>
        </div>
    ),
}));

vi.mock("./Step", () => ({
    ModalStepIndicator: () => null,
}));

vi.mock("../../../component/ToastLoading", () => ({
    ToastLoading: () => null,
}));

describe("ListenerModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should show footer when logo image fails to load", () => {
        render(
            <ListenerModal
                type="modal"
                emitter={vi.fn(async () => {})}
                metadata={{}}
                steps={{}}
                appName="test-app"
                configMetadata={{ name: "test-app" }}
                logoUrl="https://assets.example.com/logo.png"
            />
        );

        expect(screen.queryByText("origin-pairing")).not.toBeInTheDocument();

        const logo = document.querySelector("img");
        expect(logo).toBeTruthy();
        fireEvent.error(logo as HTMLImageElement);

        expect(screen.getByText("origin-pairing")).toBeInTheDocument();
        expect(screen.getByText("provided by")).toBeInTheDocument();
    });
});
