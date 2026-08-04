import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { CheckCircleFilledIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EditCard } from "@/module/common/component/EditCard";
import {
    DetailCell,
    DetailCells,
} from "@/module/merchant/component/DetailCell";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { usePurchaseWebhookStatus } from "@/module/merchant/hook/usePurchaseWebhookStatus";
import { useReadOnlyMerchant } from "@/module/merchant/hook/useReadOnlyMerchant";
import { AllowedDomainsSheet } from "../AllowedDomainsSheet";
import { AllowedPackageIdsSheet } from "../AllowedPackageIdsSheet";
import { PurchaseTrackerSheet } from "../PurchaseTrackerSheet";
import * as styles from "./integration.css";
import { NewsletterShareLink } from "./NewsletterShareLink";

const PREVIEW_COUNT = 3;

/**
 * "Integration" tab: everything describing how Frak plugs into the
 * merchant's stack — which domains and mobile apps may resolve this
 * merchant, how purchases are reported back, and the ready-made sharing
 * link for marketing emails. Nothing here has its own form state, so the
 * page needs no page-level save footer.
 */
export function MerchantIntegration({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });
    const isReadOnly = useReadOnlyMerchant({ merchantId });

    return (
        <EditPageLayout merchantId={merchantId} page="integration">
            {merchant && (
                <PreviewListCard
                    title={t("merchantEdit.domains.title")}
                    description={t("merchantEdit.domains.description")}
                    emptyLabel={t("merchantEdit.domains.empty")}
                    items={merchant.allowedDomains.map((domain) => ({
                        key: domain,
                        label: domain,
                    }))}
                >
                    {!isReadOnly && (
                        <AllowedDomainsSheet
                            merchantId={merchantId}
                            allowedDomains={merchant.allowedDomains}
                        />
                    )}
                </PreviewListCard>
            )}
            {merchant && (
                <PreviewListCard
                    title={t("merchantEdit.packageIds.title")}
                    description={t("merchantEdit.packageIds.description")}
                    emptyLabel={t("merchantEdit.packageIds.empty")}
                    items={merchant.allowedPackageIds.map((entry) => ({
                        key: `${entry.platform}:${entry.packageId}`,
                        label: entry.packageId,
                    }))}
                >
                    {!isReadOnly && (
                        <AllowedPackageIdsSheet
                            merchantId={merchantId}
                            allowedPackageIds={merchant.allowedPackageIds}
                        />
                    )}
                </PreviewListCard>
            )}
            <PurchaseTrackerSummary
                merchantId={merchantId}
                isReadOnly={isReadOnly}
            />
            <NewsletterShareLink merchantId={merchantId} />
        </EditPageLayout>
    );
}

/**
 * Card showing the first few entries of an allow-list, with a "+N more" tag
 * once it overflows. `children` is the manage control, omitted when read-only.
 */
function PreviewListCard({
    title,
    description,
    emptyLabel,
    items,
    children,
}: {
    title: string;
    description: string;
    emptyLabel: string;
    items: { key: string; label: string }[];
    children?: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <EditCard title={title} description={description}>
            {items.length > 0 ? (
                <Inline space="xs">
                    {items.slice(0, PREVIEW_COUNT).map((item) => (
                        <span key={item.key} className={styles.domainTag}>
                            {item.label}
                        </span>
                    ))}
                    {items.length > PREVIEW_COUNT && (
                        <span className={styles.domainTag}>
                            {t("merchantEdit.domains.more", {
                                count: items.length - PREVIEW_COUNT,
                            })}
                        </span>
                    )}
                </Inline>
            ) : (
                <p className={styles.cellsEmpty}>{emptyLabel}</p>
            )}
            {children && <Inline space="s">{children}</Inline>}
        </EditCard>
    );
}

function PurchaseTrackerSummary({
    merchantId,
    isReadOnly,
}: {
    merchantId: string;
    isReadOnly: boolean;
}) {
    const { t } = useTranslation();
    const { data: webhookStatus, isLoading } = usePurchaseWebhookStatus({
        merchantId,
    });

    return (
        <EditCard
            title={t("merchantEdit.purchaseTracker.title")}
            description={t("merchantEdit.purchaseTracker.description")}
        >
            {isLoading || !webhookStatus ? (
                <Spinner />
            ) : (
                <DetailCells>
                    <DetailCell
                        label={t("merchantEdit.purchaseTracker.status")}
                        value={
                            webhookStatus.setup ? (
                                <Inline
                                    as="span"
                                    space="xxs"
                                    alignY="center"
                                    className={styles.statusSuccess}
                                >
                                    {t(
                                        "merchantEdit.purchaseTracker.registered"
                                    )}
                                    <CheckCircleFilledIcon
                                        width={16}
                                        height={16}
                                    />
                                </Inline>
                            ) : (
                                t("merchantEdit.purchaseTracker.notRegistered")
                            )
                        }
                    />
                    {webhookStatus.setup && (
                        <DetailCell
                            label={t("merchantEdit.purchaseTracker.platform")}
                            value={webhookStatus.platform}
                        />
                    )}
                    {webhookStatus.setup && webhookStatus.stats && (
                        <DetailCell
                            label={t("merchantEdit.purchaseTracker.tracked")}
                            value={
                                webhookStatus.stats.totalPurchaseHandled ?? 0
                            }
                        />
                    )}
                </DetailCells>
            )}
            {!isReadOnly && (
                <Inline space="s">
                    <PurchaseTrackerSheet merchantId={merchantId} />
                </Inline>
            )}
        </EditCard>
    );
}
