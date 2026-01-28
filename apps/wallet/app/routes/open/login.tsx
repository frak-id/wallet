import { Spinner } from "@frak-labs/ui/component/Spinner";
import { HandleErrors } from "@frak-labs/wallet-shared";
import { createFileRoute } from "@tanstack/react-router";
import { isHex } from "viem";
import { Grid } from "@/module/common/component/Grid";
import { OpenLoginFlow } from "@/module/open-login/component/OpenLoginFlow";

type LoginSearchParams = {
    returnUrl?: string;
    merchantId?: string;
    state?: string;
    merchantName?: string;
};

type LoginRouteContext = {
    validatedParams?: {
        returnUrl: string;
        merchantId: `0x${string}`;
        state?: string;
        merchantName?: string;
    };
    error?: Error;
};

export const Route = createFileRoute("/open/login")({
    validateSearch: (search: Record<string, unknown>): LoginSearchParams => {
        return {
            returnUrl: search.returnUrl as string | undefined,
            merchantId: search.merchantId as string | undefined,
            state: search.state as string | undefined,
            merchantName: search.merchantName as string | undefined,
        };
    },
    beforeLoad: ({ search }): LoginRouteContext => {
        const { returnUrl, merchantId, state, merchantName } = search;

        if (!returnUrl) {
            return {
                error: new Error("Missing required parameter: returnUrl"),
            };
        }
        if (!merchantId) {
            return {
                error: new Error("Missing required parameter: merchantId"),
            };
        }

        try {
            new URL(returnUrl);
        } catch {
            return {
                error: new Error("Invalid returnUrl: must be a valid URL"),
            };
        }

        if (!isHex(merchantId)) {
            return {
                error: new Error("Invalid merchantId: must be a hex string"),
            };
        }

        return {
            validatedParams: {
                returnUrl,
                merchantId,
                state,
                merchantName,
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

    const { returnUrl, merchantId, state, merchantName } =
        context.validatedParams;

    return (
        <OpenLoginFlow
            returnUrl={returnUrl}
            merchantId={merchantId}
            state={state}
            merchantName={merchantName}
        />
    );
}
