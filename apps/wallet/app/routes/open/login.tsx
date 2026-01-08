import { Spinner } from "@frak-labs/ui/component/Spinner";
import { HandleErrors } from "@frak-labs/wallet-shared";
import { createFileRoute } from "@tanstack/react-router";
import { isHex } from "viem";
import { Grid } from "@/module/common/component/Grid";
import { OpenLoginFlow } from "@/module/open-login/component/OpenLoginFlow";

type LoginSearchParams = {
    returnUrl?: string;
    productId?: string;
    state?: string;
    productName?: string;
};

type LoginRouteContext = {
    validatedParams?: {
        returnUrl: string;
        productId: `0x${string}`;
        state?: string;
        productName?: string;
    };
    error?: Error;
};

export const Route = createFileRoute("/open/login")({
    validateSearch: (search: Record<string, unknown>): LoginSearchParams => ({
        returnUrl: search.returnUrl as string | undefined,
        productId: search.productId as string | undefined,
        state: search.state as string | undefined,
        productName: search.productName as string | undefined,
    }),
    beforeLoad: ({ search }): LoginRouteContext => {
        const { returnUrl, productId, state, productName } = search;

        if (!returnUrl) {
            return {
                error: new Error("Missing required parameter: returnUrl"),
            };
        }
        if (!productId) {
            return {
                error: new Error("Missing required parameter: productId"),
            };
        }

        try {
            new URL(returnUrl);
        } catch {
            return {
                error: new Error("Invalid returnUrl: must be a valid URL"),
            };
        }

        if (!isHex(productId)) {
            return {
                error: new Error("Invalid productId: must be a hex string"),
            };
        }

        return {
            validatedParams: {
                returnUrl,
                productId,
                state,
                productName,
            },
        };
    },
    component: OpenLoginPage,
});

function OpenLoginPage() {
    const context = Route.useRouteContext() as LoginRouteContext;

    if (context.error) {
        return (
            <Grid>
                <h2>Error</h2>
                <HandleErrors error={context.error} />
            </Grid>
        );
    }

    if (!context.validatedParams) {
        return (
            <Grid>
                <Spinner />
            </Grid>
        );
    }

    const { returnUrl, productId, state, productName } =
        context.validatedParams;

    return (
        <OpenLoginFlow
            returnUrl={returnUrl}
            productId={productId}
            state={state}
            productName={productName}
        />
    );
}
