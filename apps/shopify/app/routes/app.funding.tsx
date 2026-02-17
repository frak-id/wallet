import { BankingStatus } from "app/components/Funding/Bank";
import { PurchaseStatus } from "app/components/Funding/Purchase";
import { PageHeading } from "app/components/ui/PageHeading";
import { authenticate } from "app/shopify.server";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import { getMerchantBankStatus } from "../services.server/backendMerchant";
import { getCurrentPurchases } from "../services.server/purchase";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [currentPurchases, bankStatus] = await Promise.all([
        getCurrentPurchases(context),
        getMerchantBankStatus(context, request),
    ]);
    return data({ currentPurchases, bankStatus });
};

export default function FundingPage() {
    const { currentPurchases, bankStatus } = useLoaderData<typeof loader>();
    const { t } = useTranslation();

    return (
        <s-page heading={t("funding.title")}>
            <PageHeading>{t("funding.title")}</PageHeading>
            <s-stack gap="large">
                {bankStatus && (
                    <>
                        <BankingStatus bankStatus={bankStatus} />
                        <PurchaseStatus
                            bankStatus={bankStatus}
                            currentPurchases={currentPurchases}
                        />
                    </>
                )}
                {!bankStatus && (
                    // TODO: Link to the settings / setup instructions
                    <p>Nope</p>
                )}
            </s-stack>
        </s-page>
    );
}
