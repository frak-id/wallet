import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { ListenerModal } from "./index";

// The real signature-cancel hook returns a plain callable (not a mutation
// object), so the mock must be callable to exercise the clientAborted path.
const cancelAllSignaturesMock = vi.hoisted(() => vi.fn());

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
    const modalStore = create(() => ({
        results: {} as Record<string, unknown>,
        steps: [] as Array<{ key: string }>,
        currentStep: 0,
        shouldFinish: null as Record<string, unknown> | null,
        clearModal: vi.fn(),
    }));
    return {
        modalStore,
        selectCurrentStep: () => null,
        selectCurrentStepObject: () => null,
        selectIsDismissed: () => false,
        selectShouldFinish: (state: { shouldFinish: unknown }) =>
            state.shouldFinish,
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

vi.mock("@frak-labs/wallet-shared/authentication", () => ({
    WebauthnErrorToast: () => null,
}));

vi.mock("@frak-labs/wallet-shared/common", () => ({
    InAppBrowserToast: () => null,
    Markdown: ({ md }: { md?: string }) => <span>{md}</span>,
    prefixModalCss: (name: string) => `nexus-modal-${name}`,
    trackEvent: () => {},
}));

vi.mock("@frak-labs/wallet-shared/pairing", () => ({
    getOriginPairingClient: () => ({}),
    OriginPairingState: () => <div>origin-pairing</div>,
    useCancelAllSignatureRequests: () => cancelAllSignaturesMock,
}));

vi.mock("@frak-labs/wallet-shared/pairing/usePersistentPairingClient", () => ({
    usePersistentPairingClient: () => {},
}));

vi.mock("../../../component/ToastLoading", () => ({
    ToastLoading: () => null,
}));

vi.mock("@radix-ui/react-alert-dialog", () => {
    const Stub = ({ children }: { children?: ReactNode }) => <>{children}</>;
    return {
        Root: Stub,
        Trigger: Stub,
        Portal: Stub,
        // Forward props so the overlay click (which drives onOpenChange) is
        // reachable from tests.
        Overlay: ({
            className,
            onClick,
        }: {
            className?: string;
            onClick?: () => void;
        }) => (
            <button
                type="button"
                data-testid="overlay"
                className={className}
                onClick={onClick}
            />
        ),
        Content: Stub,
        Title: Stub,
        Description: Stub,
        Action: Stub,
        Cancel: Stub,
    };
});

// The store is mocked at runtime, so drive it through a loose shape rather than
// the real (strict) ModalStore types.
type MockModalState = {
    results: Record<string, unknown>;
    steps: Array<{ key: string }>;
    currentStep: number;
    shouldFinish: Record<string, unknown> | null;
};

function setModalState(state: MockModalState) {
    (modalStore.setState as unknown as (s: MockModalState) => void)(state);
}

function renderModal(emitter = vi.fn(async (_payload: unknown) => {})) {
    render(
        <ListenerModal
            type="modal"
            emitter={emitter}
            metadata={{}}
            steps={{}}
            appName="test-app"
            configMetadata={{ name: "test-app" }}
            logoUrl="https://assets.example.com/logo.png"
        />
    );
    return emitter;
}

describe("ListenerModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the module-level modal store between tests.
        setModalState({
            results: {},
            steps: [],
            currentStep: 0,
            shouldFinish: null,
        });
    });

    test("should hide logo when image fails to load", () => {
        renderModal();

        const logo = document.querySelector("img");
        expect(logo).toBeTruthy();
        fireEvent.error(logo as HTMLImageElement);

        expect(document.querySelector("img")).toBeNull();
        expect(screen.getByText("origin-pairing")).toBeInTheDocument();
    });

    test("emits clientAborted and cancels signatures when closed with incomplete results", () => {
        setModalState({
            steps: [{ key: "login" }],
            results: {},
            currentStep: 0,
            shouldFinish: null,
        });
        const emitter = renderModal();

        fireEvent.click(screen.getByTestId("overlay"));

        expect(emitter).toHaveBeenCalledTimes(1);
        expect(emitter.mock.calls[0][0]).toMatchObject({
            error: { code: RpcErrorCodes.clientAborted },
        });
        expect(cancelAllSignaturesMock).toHaveBeenCalledTimes(1);
    });

    test("emits the collected results when closed after every step completed", () => {
        const results = { login: { wallet: "0xabc" } };
        setModalState({
            steps: [{ key: "login" }],
            results,
            currentStep: 0,
            shouldFinish: null,
        });
        const emitter = renderModal();

        fireEvent.click(screen.getByTestId("overlay"));

        expect(emitter).toHaveBeenCalledWith({ result: results });
        expect(cancelAllSignaturesMock).not.toHaveBeenCalled();
    });

    test("emits the result automatically when the store signals it should finish", () => {
        const result = { login: { wallet: "0xabc" } };
        setModalState({
            steps: [{ key: "login" }],
            results: result,
            currentStep: 0,
            shouldFinish: result,
        });
        const emitter = renderModal();

        expect(emitter).toHaveBeenCalledWith({ result });
    });
});
