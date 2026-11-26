import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import { useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";

import { DescriptionList } from "../components/ui/DescriptionList";
import { log } from "../services.server/logger";
import { getPurchase } from "../services.server/purchase";
import { POLARIS_URL } from "../utils/polaris";
import { mapPurchaseStatus } from "../utils/purchaseStatus";
import { parseChargeId } from "../utils/url";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Get and parse the charge_id query param
    const chargeId = parseChargeId(
        new URL(request.url).searchParams.get("charge_id")
    );
    if (chargeId === null) {
        return data({ purchase: null });
    }

    // Try to get the purchase
    try {
        const purchase = await getPurchase(chargeId);
        return data({ purchase });
    } catch (error) {
        log.warn({ err: error, chargeId }, "Purchase not found");
        return data({ purchase: null });
    }
};

export default function PostPurchase() {
    const { purchase } = useLoaderData<typeof loader>();
    const { t } = useTranslation();

    const close = useCallback(() => {
        window.close();
    }, []);

    return (
        <>
            <script src={POLARIS_URL} />
            <s-page>
                <s-stack gap="large-400" alignItems="center">
                    <img
                        src="https://frak.id/assets/logo-frak.png"
                        alt={t("purchasePage.logoAlt")}
                    />
                    {purchase ? (
                        <PurchasePresent purchase={purchase} />
                    ) : (
                        <NoPurchase />
                    )}
                    <s-button onClick={close}>
                        {t("purchasePage.close")}
                    </s-button>
                </s-stack>
            </s-page>
        </>
    );
}

const mailLink = (
    <s-link href="mailto:hello@frak-labs.com">hello@frak-labs.com</s-link>
);

function PurchasePresent({
    purchase,
}: {
    purchase: NonNullable<Awaited<ReturnType<typeof getPurchase>>>;
}) {
    const { t } = useTranslation();
    const amount = formatAmount(
        Number(purchase.amount),
        (purchase.currency ?? "eur") as Currency
    );

    return (
        <>
            <div style={{ textAlign: "center" }}>
                <s-heading>{t("purchasePage.thanks", { amount })}</s-heading>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>{t("purchasePage.processing")}</s-text>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>
                    <Trans
                        i18nKey="purchasePage.track"
                        components={{
                            fundingLink: <s-link href="/app/funding" />,
                        }}
                    />
                </s-text>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>
                    <Trans
                        i18nKey="purchasePage.questions"
                        components={{ mailLink }}
                    />
                </s-text>
            </div>
            <s-section>
                <s-heading>{t("purchasePage.details")}</s-heading>
                <DescriptionList
                    items={[
                        {
                            term: t("purchasePage.amount"),
                            description: amount,
                        },
                        {
                            term: t("purchasePage.status"),
                            description: mapPurchaseStatus(purchase, t).status,
                        },
                        {
                            term: t("purchasePage.reference"),
                            description:
                                purchase.txHash ??
                                t("status.purchase.notAvailableYet"),
                        },
                    ]}
                />
            </s-section>
        </>
    );
}

function NoPurchase() {
    const { t } = useTranslation();

    return (
        <>
            <div style={{ textAlign: "center" }}>
                <s-heading>{t("purchasePage.notFound")}</s-heading>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>
                    <Trans
                        i18nKey="purchasePage.notFoundHelp"
                        components={{ mailLink }}
                    />
                </s-text>
            </div>
        </>
    );
}
