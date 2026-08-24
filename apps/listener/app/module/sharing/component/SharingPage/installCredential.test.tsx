import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { ListenerSharingPage } from "./index";

const orderClientGet = vi.hoisted(() => vi.fn());
const estimatedRewardsGet = vi.hoisted(() => vi.fn());
const requestParams = vi.hoisted(
    () => ({ current: {} }) as { current: Record<string, unknown> }
);
const storedClientId = vi.hoisted(
    () => ({ current: null }) as { current: string | null }
);
const storedInstallProof = vi.hoisted(
    () => ({ current: undefined }) as { current: string | undefined }
);
// The FrakContext v2 codec rejects a non-UUID merchant or client id
// (`encodeFrakContextV2`), which would silently null the share link. The
// minted id is the shape `/order-client` returns for a group whose only
// anonymous node the backend created itself.
const { MERCHANT_ID, ORDER_DERIVED_ID, MINTED_ID, SDK_ID } = vi.hoisted(() => ({
    MERCHANT_ID: "11111111-1111-4111-8111-111111111111",
    ORDER_DERIVED_ID: "22222222-2222-4222-8222-222222222222",
    MINTED_ID: "frakmint_22222222-2222-4222-8222-222222222222",
    SDK_ID: "33333333-3333-4333-8333-333333333333",
}));

vi.mock("@/ui/ListenerUiProvider", () => ({
    useListenerTranslation: () => ({ t: (key: string) => key }),
    useSharingListenerUI: () => ({
        currentRequest: {
            appName: "Acme",
            logoUrl: undefined,
            params: {
                link: "https://acme.example/product",
                ...requestParams.current,
            },
            emitter: vi.fn(),
            targetInteraction: undefined,
            i18n: undefined,
            configMetadata: undefined,
        },
        clearRequest: vi.fn(),
    }),
}));

vi.mock("@/module/stores/hooks", () => ({
    useSafeResolvingContext: () => ({
        sourceUrl: "https://acme.example",
        merchantId: MERCHANT_ID,
        installProof: storedInstallProof.current,
    }),
}));

vi.mock("@/module/stores/resolvingContextStore", () => ({
    resolvingContextStore: createStore(() => ({
        backendSdkConfig: undefined,
    })),
}));

vi.mock("@/module/hooks/useTrackSharing", () => ({
    useTrackSharing: () => ({ mutate: vi.fn() }),
}));

// A getter rather than a value: the store is built once, at mock time, while
// each case picks the id it needs in `beforeEach`.
vi.mock("@frak-labs/wallet-shared/stores/clientIdStore", () => ({
    clientIdStore: createStore(() => ({
        get clientId() {
            return storedClientId.current;
        },
    })),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: { "order-client": { get: orderClientGet } },
            merchant: { "estimated-rewards": { get: estimatedRewardsGet } },
        },
    },
}));

vi.mock("@frak-labs/wallet-shared/sharing", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/wallet-shared/sharing")
        >();
    return {
        ...actual,
        SharingPage: (props: {
            installUrl: string | null;
            sharingLink: string | null;
        }) => (
            <div
                data-testid="sharing-page"
                data-install-url={props.installUrl ?? ""}
                data-sharing-link={props.sharingLink ?? ""}
            />
        ),
    };
});

describe("ListenerSharingPage install credential", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storedClientId.current = null;
        storedInstallProof.current = "the-install-proof";
        requestParams.current = {};
        orderClientGet.mockResolvedValue({
            data: { clientId: ORDER_DERIVED_ID },
            error: null,
        });
        estimatedRewardsGet.mockResolvedValue({ data: null, error: null });
    });

    test("carries the checkout token when the SDK holds no anonymous id", async ({
        queryWrapper,
    }) => {
        requestParams.current = { checkoutToken: "tok-1" };

        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });

        expect(screen.getByTestId("sharing-page").dataset.installUrl).toBe(
            `${window.location.origin}/install?m=${MERCHANT_ID}&checkoutToken=tok-1`
        );
        await waitFor(() => {
            expect(orderClientGet).toHaveBeenCalledWith({
                query: { merchantId: MERCHANT_ID, checkoutToken: "tok-1" },
            });
        });
    });

    test("prefers the SDK id and its proof, and never sends the token alongside", ({
        queryWrapper,
    }) => {
        storedClientId.current = SDK_ID;
        requestParams.current = { checkoutToken: "tok-1" };

        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });

        const url = screen.getByTestId("sharing-page").dataset.installUrl ?? "";
        expect(url).toContain(`a=${SDK_ID}`);
        expect(url).toContain("#p=the-install-proof");
        expect(url).not.toContain("checkoutToken");
        expect(orderClientGet).not.toHaveBeenCalled();
    });

    test("drops an unproven SDK id for the token, since generate refuses it", ({
        queryWrapper,
    }) => {
        storedClientId.current = SDK_ID;
        storedInstallProof.current = undefined;
        requestParams.current = { checkoutToken: "tok-1" };

        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });

        // `a=` alone 403s PROOF_REQUIRED, which renders as a dead CTA.
        expect(screen.getByTestId("sharing-page").dataset.installUrl).toBe(
            `${window.location.origin}/install?m=${MERCHANT_ID}&checkoutToken=tok-1`
        );
    });

    test("still builds a credentialless link when neither is provable", ({
        queryWrapper,
    }) => {
        storedClientId.current = SDK_ID;
        storedInstallProof.current = undefined;

        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });

        expect(screen.getByTestId("sharing-page").dataset.installUrl).toBe("");
    });

    test("attributes the share link to the order-derived id", async ({
        queryWrapper,
    }) => {
        requestParams.current = { checkoutToken: "tok-1" };

        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => {
            expect(
                screen.getByTestId("sharing-page").dataset.sharingLink
            ).toContain("fCtx=");
        });
    });

    test("discards a server-minted id rather than feed it to the codec", async ({
        queryWrapper,
    }) => {
        orderClientGet.mockResolvedValue({
            data: { clientId: MINTED_ID },
            error: null,
        });
        requestParams.current = { checkoutToken: "tok-1" };

        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(orderClientGet).toHaveBeenCalled());

        // The install CTA still works — it rides the token, not the id.
        expect(screen.getByTestId("sharing-page").dataset.installUrl).toBe(
            `${window.location.origin}/install?m=${MERCHANT_ID}&checkoutToken=tok-1`
        );
        // The share link cannot: `encodeFrakContextV2` takes UUIDs only.
        expect(screen.getByTestId("sharing-page").dataset.sharingLink).toBe("");
    });

    test("builds no install url without a credential of either kind", ({
        queryWrapper,
    }) => {
        render(<ListenerSharingPage />, { wrapper: queryWrapper.wrapper });

        expect(screen.getByTestId("sharing-page").dataset.installUrl).toBe("");
        expect(orderClientGet).not.toHaveBeenCalled();
    });
});
