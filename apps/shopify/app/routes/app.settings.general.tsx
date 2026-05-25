import { ConnectedShopInfo } from "app/components/ConnectedShopInfo";
import { Stepper } from "app/components/Stepper";
import { resolveMerchantInfo } from "app/services.server/merchant";
import {
    ensureFrakI18nMetaobject,
    type FrakI18nSyncResult,
} from "app/services.server/metafields";
import { authenticate } from "app/shopify.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const merchantInfo = await resolveMerchantInfo(context);
    return data({ merchantInfo });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    if (formData.get("intent") === "resync-i18n") {
        const syncResult = await ensureFrakI18nMetaobject(context, {
            bypassCache: true,
        });
        return data({ syncResult });
    }
    return data({});
};

export default function SettingsGeneralPage() {
    const { merchantInfo } = useLoaderData<typeof loader>();

    return (
        <s-stack gap="large">
            {merchantInfo && <ConnectedShopInfo merchantInfo={merchantInfo} />}
            <Stepper redirectToApp={false} />
            <I18nSyncDebugCard />
        </s-stack>
    );
}

function I18nSyncDebugCard() {
    const fetcher = useFetcher<{ syncResult?: FrakI18nSyncResult }>();
    const isLoading = fetcher.state !== "idle";
    const result = fetcher.data?.syncResult;
    return (
        <s-section heading="Translations debug">
            <s-stack gap="base">
                <s-text>
                    Force re-sync the Frak Translations metaobject (creates the
                    entry if missing and registers bundled French translations).
                    Surfaces the exact Shopify error if something fails.
                </s-text>
                <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="resync-i18n" />
                    <s-button
                        type="submit"
                        disabled={isLoading}
                        variant="secondary"
                    >
                        {isLoading ? "Re-syncing…" : "Force re-sync"}
                    </s-button>
                </fetcher.Form>
                {result && <I18nSyncResultDisplay result={result} />}
            </s-stack>
        </s-section>
    );
}

function I18nSyncResultDisplay({ result }: { result: FrakI18nSyncResult }) {
    const ok = result.errors.length === 0;
    return (
        <s-stack gap="small">
            <s-text>
                <strong>Definition:</strong>{" "}
                {result.definitionOk ? "OK" : "FAILED"}
            </s-text>
            <s-text>
                <strong>Entry ID:</strong> {result.entryId ?? "(none)"}
            </s-text>
            <s-text>
                <strong>FR translations registered:</strong>{" "}
                {result.frTranslationsRegistered}
            </s-text>
            {ok ? (
                <s-text>All steps succeeded.</s-text>
            ) : (
                <s-stack gap="small">
                    <s-text>
                        <strong>Errors:</strong>
                    </s-text>
                    {result.errors.map((err) => (
                        <s-text key={err}>{err}</s-text>
                    ))}
                </s-stack>
            )}
        </s-stack>
    );
}
