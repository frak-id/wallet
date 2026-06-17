import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckCircleFilledIcon } from "@frak-labs/design-system/icons";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { EditCard } from "@/module/common/component/EditCard";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import { detectStablecoinFromAddress } from "@/module/common/utils/stablecoin";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { usePurchaseWebhookStatus } from "@/module/merchant/hook/usePurchaseWebhookStatus";
import { AllowedDomainsSheet } from "../AllowedDomainsSheet";
import { SaveFooter } from "../Customize/SaveFooter";
import { MerchantEditSheet } from "../MerchantEditSheet";
import { PurchaseTrackerSheet } from "../PurchaseTrackerSheet";
import { CustomizeSaveProvider } from "../saveRegistry";
import { ExplorerSettings } from "./ExplorerSettings";
import * as styles from "./merchant-summary.css";
import { NewsletterShareLink } from "./NewsletterShareLink";

const DOMAIN_PREVIEW_COUNT = 3;

export function MerchantDetails({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });

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
                            <div className={styles.detailCells}>
                                <div className={styles.detailCell}>
                                    <span className={styles.cellLabel}>
                                        {t("merchantEdit.details.name")}
                                    </span>
                                    <span className={styles.cellValue}>
                                        {merchant.name}
                                    </span>
                                </div>
                                <div className={styles.detailCell}>
                                    <span className={styles.cellLabel}>
                                        {t("merchantEdit.details.domain")}
                                    </span>
                                    <span className={styles.cellValue}>
                                        {merchant.domain}
                                    </span>
                                </div>
                                <div className={styles.detailCell}>
                                    <span className={styles.cellLabel}>
                                        {t("merchantEdit.details.currency")}
                                    </span>
                                    <span className={styles.cellValue}>
                                        {currency ? currency.label : "—"}
                                    </span>
                                </div>
                            </div>
                            <Inline space="s">
                                <MerchantEditSheet
                                    merchant={merchant}
                                    merchantId={merchantId}
                                />
                            </Inline>
                        </EditCard>
                    )}
                    {merchant && (
                        <EditCard
                            title={t("merchantEdit.domains.title")}
                            description={t("merchantEdit.domains.description")}
                        >
                            {merchant.allowedDomains.length > 0 ? (
                                <Inline space="xs">
                                    {merchant.allowedDomains
                                        .slice(0, DOMAIN_PREVIEW_COUNT)
                                        .map((domain) => (
                                            <span
                                                key={domain}
                                                className={styles.domainTag}
                                            >
                                                {domain}
                                            </span>
                                        ))}
                                    {merchant.allowedDomains.length >
                                        DOMAIN_PREVIEW_COUNT && (
                                        <span className={styles.domainTag}>
                                            {t("merchantEdit.domains.more", {
                                                count:
                                                    merchant.allowedDomains
                                                        .length -
                                                    DOMAIN_PREVIEW_COUNT,
                                            })}
                                        </span>
                                    )}
                                </Inline>
                            ) : (
                                <p className={styles.cellsEmpty}>
                                    {t("merchantEdit.domains.empty")}
                                </p>
                            )}
                            <Inline space="s">
                                <AllowedDomainsSheet
                                    merchantId={merchantId}
                                    allowedDomains={merchant.allowedDomains}
                                />
                            </Inline>
                        </EditCard>
                    )}
                    <NewsletterShareLink merchantId={merchantId} />
                    <ExplorerSettings merchantId={merchantId} />
                    <PurchaseTrackerSummary merchantId={merchantId} />
                    {saveError && (
                        <Text variant="caption" color="error">
                            {t("merchantEdit.saveError")}
                        </Text>
                    )}
                </EditPageLayout>
            </div>
            <SaveFooter
                disabled={!hasUnsavedChanges}
                isSaving={isSaving}
                onSave={saveAll}
                label={t("merchantEdit.saveAll")}
            />
            <DiscardChangesDialog {...discardDialogProps} />
        </CustomizeSaveProvider>
    );
}

function PurchaseTrackerSummary({ merchantId }: { merchantId: string }) {
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
                <div className={styles.detailCells}>
                    <div className={styles.detailCell}>
                        <span className={styles.cellLabel}>
                            {t("merchantEdit.purchaseTracker.status")}
                        </span>
                        <span className={styles.cellValue}>
                            {webhookStatus.setup ? (
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
                            )}
                        </span>
                    </div>
                    {webhookStatus.setup && (
                        <div className={styles.detailCell}>
                            <span className={styles.cellLabel}>
                                {t("merchantEdit.purchaseTracker.platform")}
                            </span>
                            <span className={styles.cellValue}>
                                {webhookStatus.platform}
                            </span>
                        </div>
                    )}
                    {webhookStatus.setup && webhookStatus.stats && (
                        <div className={styles.detailCell}>
                            <span className={styles.cellLabel}>
                                {t("merchantEdit.purchaseTracker.tracked")}
                            </span>
                            <span className={styles.cellValue}>
                                {webhookStatus.stats.totalPurchaseHandled ?? 0}
                            </span>
                        </div>
                    )}
                </div>
            )}
            <Inline space="s">
                <PurchaseTrackerSheet merchantId={merchantId} />
            </Inline>
        </EditCard>
    );
}
