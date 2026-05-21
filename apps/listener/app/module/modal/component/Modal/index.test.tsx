import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { ListenerModal } from "./index";

vi.mock("@/module/hooks/useGetMergeToken", () => ({
    useGetMergeToken: () => vi.fn(),
}));

vi.mock("@/ui/BlockchainProvider", () => ({
    BlockchainProvider: ({ children }: { children: ReactNode }) => (
        <>{children}</>
    ),
}));

vi.mock("@/ui/ListenerUiProvider", () => ({
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

vi.mock("@/module/stores/modalStore", async () => {
    const { create } = await import("zustand");
    const modalStore = create<{ results: object; steps: never[] }>(() => ({
        results: {},
        steps: [],
    }));
    return {
        modalStore,
        selectCurrentStep: () => null,
        selectCurrentStepObject: () => null,
        selectIsDismissed: () => false,
        selectShouldFinish: () => null,
    };
});

vi.mock("@/module/stores/resolvingContextStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    const resolvingContextStore = createStore(() => ({
        context: {
            sourceUrl: "https://example.com",
        },
    }));
    return { resolvingContextStore };
});

vi.mock("@frak-labs/wallet-shared/common", () => ({
    Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DrawerContent: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
    InAppBrowserToast: () => null,
    LogoFrakWithName: ({ className }: { className?: string }) => (
        <span className={className}>frak-logo</span>
    ),
    prefixModalCss: (name: string) => `nexus-modal-${name}`,
    trackEvent: () => {},
    WalletModal: ({ title, text }: { title: ReactNode; text: ReactNode }) => (
        <div>
            <div>{title}</div>
            <div>{text}</div>
        </div>
    ),
}));

vi.mock("@frak-labs/wallet-shared/pairing", () => ({
    getOriginPairingClient: () => ({}),
    OriginPairingState: () => <div>origin-pairing</div>,
    useCancelAllSignatureRequests: () => ({
        mutate: () => {},
        isPending: false,
    }),
}));

vi.mock("./Step", () => ({
    ModalStepIndicator: () => null,
}));

vi.mock("../../../component/ToastLoading", () => ({
    ToastLoading: () => null,
}));

vi.mock("sonner", () => ({
    Toaster: () => null,
    toast: { error: () => {}, success: () => {} },
}));

vi.mock("lucide-react", () => ({
    X: () => <span>X</span>,
}));

vi.mock("@radix-ui/react-alert-dialog", () => {
    const Stub = ({ children }: { children?: ReactNode }) => <>{children}</>;
    return {
        Root: Stub,
        Trigger: Stub,
        Portal: Stub,
        Overlay: Stub,
        Content: Stub,
        Title: Stub,
        Description: Stub,
        Action: Stub,
        Cancel: Stub,
    };
});

describe("ListenerModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should hide logo when image fails to load", () => {
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

        const logo = document.querySelector("img");
        expect(logo).toBeTruthy();
        fireEvent.error(logo as HTMLImageElement);

        expect(document.querySelector("img")).toBeNull();
        expect(screen.getByText("provided by")).toBeInTheDocument();
        expect(screen.getByText("origin-pairing")).toBeInTheDocument();
    });
});
