import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { DemoAccount } from "./index";

const mockDecodeJwt = vi.fn();
type StoreState = {
    demoPrivateKey?: string;
    sdkSession?: { token: string } | null;
};

vi.mock("@frak-labs/wallet-shared", async () => {
    const { createStore } = await import("zustand/vanilla");
    return {
        selectDemoPrivateKey: vi.fn((state: any) => state?.demoPrivateKey),
        selectSdkSession: vi.fn((state: any) => state?.sdkSession),
        sessionStore: createStore<StoreState>(() => ({
            demoPrivateKey: undefined,
            sdkSession: undefined,
        })),
    };
});

vi.mock("jose", () => ({
    decodeJwt: (token: string) => mockDecodeJwt(token),
}));

vi.mock("@/module/common/component/Panel", () => ({
    Panel: ({
        variant,
        size,
        children,
    }: {
        variant?: string;
        size?: string;
        children: React.ReactNode;
    }) => (
        <div data-testid="panel" data-variant={variant} data-size={size}>
            {children}
        </div>
    ),
}));

describe("DemoAccount", () => {
    let mockStoreState: StoreState;

    beforeEach(async () => {
        vi.clearAllMocks();
        // `vi.mock` replaces `sessionStore` with a vanilla store typed for the
        // local `StoreState`, but TypeScript resolves the import against the
        // real `@frak-labs/wallet-shared` types. Cast to the mock's shape so
        // `setState` is correctly typed without using `any`.
        const { sessionStore } = (await import(
            "@frak-labs/wallet-shared"
        )) as unknown as { sessionStore: StoreApi<StoreState> };
        sessionStore.setState(
            { demoPrivateKey: undefined, sdkSession: undefined },
            true
        );
        mockStoreState = new Proxy({} as StoreState, {
            get: (_, key) => sessionStore.getState()[key as keyof StoreState],
            set: (_, key, value) => {
                sessionStore.setState({
                    [key as keyof StoreState]: value,
                });
                return true;
            },
        });
    });

    it("should return null when not a demo account", () => {
        const { container } = render(<DemoAccount />);

        expect(container.firstChild).toBeNull();
    });

    it("should render when demo private key exists", () => {
        mockStoreState.demoPrivateKey = "demo-key";

        render(<DemoAccount />);

        expect(screen.getByText("Demo Account")).toBeInTheDocument();
        expect(screen.getByTestId("panel")).toBeInTheDocument();
    });

    it("should render when SDK session has demoPkey", () => {
        mockDecodeJwt.mockReturnValue({
            additionalData: { demoPkey: "demo-key" },
        });
        mockStoreState.sdkSession = { token: "test-token" };

        render(<DemoAccount />);

        expect(screen.getByText("Demo Account")).toBeInTheDocument();
    });

    it("should not render when SDK session exists but no demoPkey", () => {
        mockDecodeJwt.mockReturnValue({
            additionalData: {},
        });
        mockStoreState.sdkSession = { token: "test-token" };

        const { container } = render(<DemoAccount />);

        expect(container.firstChild).toBeNull();
    });

    it("should not render when decodeJwt returns null", () => {
        mockDecodeJwt.mockReturnValue(null);
        mockStoreState.sdkSession = { token: "test-token" };

        const { container } = render(<DemoAccount />);

        expect(container.firstChild).toBeNull();
    });

    it("should not render when SDK session is null", () => {
        mockStoreState.sdkSession = null;

        const { container } = render(<DemoAccount />);

        expect(container.firstChild).toBeNull();
    });

    it("should render Panel with invisible variant and none size", () => {
        mockStoreState.demoPrivateKey = "demo-key";

        render(<DemoAccount />);

        const panel = screen.getByTestId("panel");
        expect(panel).toHaveAttribute("data-variant", "invisible");
        expect(panel).toHaveAttribute("data-size", "none");
    });

    it("should render warning icon and text", () => {
        mockStoreState.demoPrivateKey = "demo-key";

        render(<DemoAccount />);

        expect(screen.getByText("Demo Account")).toBeInTheDocument();
        const warning = screen.getByText("⚠");
        expect(warning).toBeInTheDocument();
    });
});
