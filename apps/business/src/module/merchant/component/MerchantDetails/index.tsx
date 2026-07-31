import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckCircleFilledIcon } from "@frak-labs/design-system/icons";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { EditCard } from "@/module/common/component/EditCard";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import { detectStablecoinFromAddress } from "@/module/common/utils/stablecoin";
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
import { SaveFooter } from "../Customize/SaveFooter";
import { MerchantEditSheet } from "../MerchantEditSheet";
import { PurchaseTrackerSheet } from "../PurchaseTrackerSheet";
import { CustomizeSaveProvider } from "../saveRegistry";
import { ExplorerSettings } from "./ExplorerSettings";
import * as styles from "./merchant-summary.css";
import { NewsletterShareLink } from "./NewsletterShareLink";

const PREVIEW_COUNT = 3;

export function MerchantDetails({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });
    const isReadOnly = useReadOnlyMerchant({ merchantId });

    const [dirtySections, setDirtySections] = useState<Record<string, boolean>>(
        {}
    );
    const [isSaving, setIsSaving] = useState(false);
    // Lazy init: useRef(new Map()) would rebuild and discard the Map on
    // every render.
    const submitHandlers = useRef<Map<string, () => Promise<void>> | null>(
        null
    );
    if (submitHandlers.current === null) {
        submitHandlers.current = new Map();
    }
    const handlers = submitHandlers.current;

    const onDirtyChange = useCallback((key: string, isDirty: boolean) => {
        setDirtySections((prev) => {
            if (prev[key] === isDirty) return prev;
            return { ...prev, [key]: isDirty };
        });
    }, []);

    const registerSection = useCallback(
        (key: string, submit: () => Promise<void>) => {
            handlers.set(key, submit);
            return () => {
                if (handlers.get(key) === submit) {
                    handlers.delete(key);
                }
            };
        },
        [handlers]
    );

    const saveContext = useMemo(
        () => ({ registerSection, onDirtyChange }),
        [registerSection, onDirtyChange]
    );

    const hasUnsavedChanges = useMemo(
        () => Object.values(dirtySections).some(Boolean),
        [dirtySections]
    );

    const [saveError, setSaveError] = useState(false);

    const saveAll = useCallback(async () => {
        setIsSaving(true);
        setSaveError(false);
        try {
            // Sequential on purpose: the backend merges each section over a
            // fresh read, so concurrent saves would drop fields.
            for (const [key, isDirty] of Object.entries(dirtySections)) {
                if (!isDirty) continue;
                try {
                    await handlers.get(key)?.();
                } catch {
                    // Failed/invalid section stays dirty; keep saving the rest.
                    setSaveError(true);
                }
            }
        } finally {
            setIsSaving(false);
        }
    }, [dirtySections, handlers]);

    const { guard: guardNavigate, dialogProps: discardDialogProps } =
        useDiscardGuard({ isDirty: hasUnsavedChanges });

    const stablecoin = merchant
        ? (detectStablecoinFromAddress(merchant.defaultRewardToken) ?? "eure")
        : undefined;
    const currency = stablecoin ? currencyMetadata[stablecoin] : undefined;

    return (
        <CustomizeSaveProvider value={saveContext}>
            <div className={pageBottomSpacer}>
                <EditPageLayout
                    merchantId={merchantId}
                    page="details"
                    guardNavigate={guardNavigate}
                >
                    {merchant && (
                        <EditCard title={t("merchantEdit.details.title")}>
                            <DetailCells>
                                <DetailCell
                                    label={t("merchantEdit.details.name")}
                                    value={merchant.name}
                                />
                                <DetailCell
                                    label={t("merchantEdit.details.domain")}
                                    value={merchant.domain}
                                />
                                <DetailCell
                                    label={t("merchantEdit.details.currency")}
                                    value={currency ? currency.label : "—"}
                                />
                            </DetailCells>
                            {!isReadOnly && (
                                <Inline space="s">
                                    <MerchantEditSheet
                                        merchant={merchant}
                                        merchantId={merchantId}
                                    />
                                </Inline>
                            )}
                        </EditCard>
                    )}
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
                            description={t(
                                "merchantEdit.packageIds.description"
                            )}
                            emptyLabel={t("merchantEdit.packageIds.empty")}
                            items={merchant.allowedPackageIds.map((entry) => ({
                                key: `${entry.platform}:${entry.packageId}`,
                                label: entry.packageId,
                            }))}
                        >
                            {!isReadOnly && (
                                <AllowedPackageIdsSheet
                                    merchantId={merchantId}
                                    allowedPackageIds={
                                        merchant.allowedPackageIds
                                    }
                                />
                            )}
                        </PreviewListCard>
                    )}
                    <NewsletterShareLink merchantId={merchantId} />
                    {!isReadOnly && (
                        <ExplorerSettings merchantId={merchantId} />
                    )}
                    <PurchaseTrackerSummary
                        merchantId={merchantId}
                        isReadOnly={isReadOnly}
                    />
                    {saveError && (
                        <Text variant="caption" color="error">
                            {t("merchantEdit.saveError")}
                        </Text>
                    )}
                </EditPageLayout>
            </div>
            {!isReadOnly && (
                <SaveFooter
                    disabled={!hasUnsavedChanges}
                    isSaving={isSaving}
                    onSave={saveAll}
                    label={t("merchantEdit.saveAll")}
                />
            )}
            <DiscardChangesDialog {...discardDialogProps} />
        </CustomizeSaveProvider>
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
