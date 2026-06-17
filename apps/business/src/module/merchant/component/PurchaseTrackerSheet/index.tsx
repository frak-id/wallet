import { Button } from "@frak-labs/design-system/components/Button";
import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    Sheet,
    SheetContent,
    SheetToolbar,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { CheckCircleFilledIcon } from "@frak-labs/design-system/icons";
import { type ReactNode, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { generatePrivateKey } from "viem/accounts";
import { Badge } from "@/module/common/component/Badge";
import { Button as BusinessButton } from "@/module/common/component/Button";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { EditCard } from "@/module/common/component/EditCard";
import { TextWithCopy } from "@/module/common/component/TextWithCopy";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import {
    usePurchaseWebhookStatus,
    type WebhookPlatform,
    type WebhookStatus,
} from "@/module/merchant/hook/usePurchaseWebhookStatus";
import { useWebhookSetup } from "@/module/merchant/hook/useWebhookSetup";
import * as cells from "../detail-cells.css";
import * as styles from "./purchase-tracker-sheet.css";

export function PurchaseTrackerSheet({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <BusinessButton variant="secondary" size="small">
                    {t("merchantEdit.purchaseTracker.update")}
                </BusinessButton>
            </SheetTrigger>
            <SheetContent
                side="right"
                size="wide"
                padded={false}
                hideCloseButton
            >
                <SheetToolbar
                    size="large"
                    leading={
                        <GlassCloseButton
                            onClick={() => setOpen(false)}
                            aria-label={t("merchantEdit.close")}
                        />
                    }
                    title={t("merchantEdit.purchaseTracker.title")}
                    subtitle={t(
                        "merchantEdit.purchaseTracker.sheet.description"
                    )}
                />
                <PurchaseTrackerSheetBody merchantId={merchantId} />
            </SheetContent>
        </Sheet>
    );
}

function PurchaseTrackerSheetBody({ merchantId }: { merchantId: string }) {
    const { data: webhookStatus, isLoading } = usePurchaseWebhookStatus({
        merchantId,
    });

    if (isLoading || !webhookStatus) {
        return (
            <Stack space="l" padding="l">
                <Spinner />
            </Stack>
        );
    }

    return (
        <Stack space="l" padding="l">
            <StatusCard status={webhookStatus} />
            <PlatformCard
                merchantId={merchantId}
                webhookStatus={webhookStatus}
            />
            {webhookStatus.setup && webhookStatus.stats && (
                <StatsCard stats={webhookStatus.stats} />
            )}
        </Stack>
    );
}

function StatusCard({ status }: { status: WebhookStatus }) {
    const { t } = useTranslation();

    return (
        <EditCard title={t("merchantEdit.purchaseTracker.status")}>
            <div className={cells.detailCells}>
                <div className={cells.detailCell}>
                    <span className={cells.cellLabel}>
                        {t("merchantEdit.purchaseTracker.status")}
                    </span>
                    <span className={cells.cellValue}>
                        {status.setup ? (
                            <Inline
                                as="span"
                                space="xxs"
                                alignY="center"
                                className={cells.statusSuccess}
                            >
                                {t("merchantEdit.purchaseTracker.registered")}
                                <CheckCircleFilledIcon width={16} height={16} />
                            </Inline>
                        ) : (
                            t("merchantEdit.purchaseTracker.notRegistered")
                        )}
                    </span>
                </div>
                {status.setup && status.platform && (
                    <div className={cells.detailCell}>
                        <span className={cells.cellLabel}>
                            {t("merchantEdit.purchaseTracker.platform")}
                        </span>
                        <span className={cells.cellValue}>
                            {status.platform}
                        </span>
                    </div>
                )}
            </div>
        </EditCard>
    );
}

const SELECTABLE_PLATFORMS: WebhookPlatform[] = [
    "shopify",
    "woocommerce",
    "magento",
    "custom",
];

function PlatformCard({
    merchantId,
    webhookStatus,
}: {
    merchantId: string;
    webhookStatus: WebhookStatus;
}) {
    const { t } = useTranslation();
    const initialState: WebhookPlatform = webhookStatus.setup
        ? webhookStatus.platform
        : "shopify";
    const [currentPlatform, setCurrentPlatform] =
        useState<WebhookPlatform>(initialState);
    const [pendingPlatform, setPendingPlatform] =
        useState<WebhookPlatform | null>(null);

    const webhookUrl = useMemo(() => {
        return `${process.env.BACKEND_URL}/ext/merchant/${merchantId}/webhook/purchases/${currentPlatform}`;
    }, [merchantId, currentPlatform]);

    const handlePlatformChange = (platform: WebhookPlatform) => {
        if (platform === currentPlatform) return;
        if (!webhookStatus.setup) {
            setCurrentPlatform(platform);
            return;
        }
        setPendingPlatform(platform);
    };

    return (
        <EditCard title={t("merchantEdit.purchaseTracker.sheet.platformTitle")}>
            <Inline space="xs">
                {SELECTABLE_PLATFORMS.map((platform) => (
                    <Badge
                        key={platform}
                        onClick={() => handlePlatformChange(platform)}
                        variant={
                            currentPlatform === platform
                                ? "success"
                                : "secondary"
                        }
                    >
                        {t(
                            `merchantEdit.purchaseTracker.sheet.platforms.${platform}`
                        )}
                    </Badge>
                ))}
                <Badge
                    variant={
                        currentPlatform === "internal" ? "success" : "secondary"
                    }
                    disabled
                >
                    {t("merchantEdit.purchaseTracker.sheet.platforms.internal")}
                </Badge>
            </Inline>
            <PlatformRegistration
                platform={currentPlatform}
                webhookUrl={webhookUrl}
                merchantId={merchantId}
                currentSigninKey={
                    webhookStatus.setup
                        ? webhookStatus.webhookSigninKey
                        : undefined
                }
            />
            <ConfirmDialog
                open={pendingPlatform !== null}
                onOpenChange={(o) => !o && setPendingPlatform(null)}
                title={t("merchantEdit.purchaseTracker.sheet.change.title")}
                description={
                    currentPlatform === "internal"
                        ? `${t("merchantEdit.purchaseTracker.sheet.change.description")} ${t("merchantEdit.purchaseTracker.sheet.change.internalWarning")}`
                        : t(
                              "merchantEdit.purchaseTracker.sheet.change.description"
                          )
                }
                cancelLabel={t("merchantEdit.editMerchant.cancel")}
                confirmLabel={t(
                    "merchantEdit.purchaseTracker.sheet.change.confirm"
                )}
                confirmTone="destructive"
                onConfirm={() => {
                    if (pendingPlatform) setCurrentPlatform(pendingPlatform);
                    setPendingPlatform(null);
                }}
            />
        </EditCard>
    );
}

function CopyCell({ label, value }: { label: string; value: string }) {
    return (
        <Inline
            space="m"
            alignY="center"
            wrap={false}
            paddingX="m"
            paddingY="xs"
            className={styles.copyCell}
        >
            <TextWithCopy text={value}>
                <span className={styles.copyCellLabel}>{label}</span>
                <span className={styles.copyCellValue}>{value}</span>
            </TextWithCopy>
        </Inline>
    );
}

function RegistrationLayout({
    intro,
    webhookUrl,
    signinKey,
    children,
}: {
    intro: ReactNode;
    webhookUrl?: string;
    signinKey?: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <Stack space="m">
            <p className={styles.instructions}>{intro}</p>
            {webhookUrl && (
                <CopyCell
                    label={t("merchantEdit.purchaseTracker.sheet.urlLabel")}
                    value={webhookUrl}
                />
            )}
            {signinKey && (
                <CopyCell
                    label={t("merchantEdit.purchaseTracker.sheet.secretLabel")}
                    value={signinKey}
                />
            )}
            {children}
        </Stack>
    );
}

function RegisterButton({
    isPending,
    isUpdate,
    onClick,
    type = "button",
}: {
    isPending: boolean;
    isUpdate: boolean;
    onClick?: () => void;
    type?: "button" | "submit";
}) {
    const { t } = useTranslation();

    return (
        <div>
            <Button
                type={type}
                variant="primary"
                size="small"
                width="auto"
                disabled={isPending}
                loading={isPending}
                onClick={onClick}
            >
                {isUpdate
                    ? t("merchantEdit.purchaseTracker.update")
                    : t("merchantEdit.purchaseTracker.sheet.register")}
            </Button>
        </div>
    );
}

function PlatformRegistration({
    platform,
    webhookUrl,
    merchantId,
    currentSigninKey,
}: {
    platform: WebhookPlatform;
    webhookUrl: string;
    merchantId: string;
    currentSigninKey?: string;
}) {
    if (platform === "internal") {
        return <InternalRegistration />;
    }

    if (platform === "shopify") {
        return (
            <ShopifyRegistrationForm
                merchantId={merchantId}
                webhookUrl={webhookUrl}
                currentSigninKey={currentSigninKey}
            />
        );
    }

    return (
        <KeyedRegistration
            platform={platform}
            merchantId={merchantId}
            webhookUrl={webhookUrl}
            currentSigninKey={currentSigninKey}
        />
    );
}

/** WooCommerce / Magento / Custom: generated secret + register button. */
function KeyedRegistration({
    platform,
    merchantId,
    webhookUrl,
    currentSigninKey,
}: {
    platform: Exclude<WebhookPlatform, "shopify" | "internal">;
    merchantId: string;
    webhookUrl: string;
    currentSigninKey?: string;
}) {
    const { t } = useTranslation();
    const { mutate: setupWebhook, isPending } = useWebhookSetup({ merchantId });

    const signinKey = useMemo(
        () => currentSigninKey ?? generatePrivateKey(),
        [currentSigninKey]
    );

    const intro = {
        woocommerce: (
            <Trans
                i18nKey="merchantEdit.purchaseTracker.sheet.instructions.woocommerce"
                components={{ italic: <i /> }}
            />
        ),
        magento: (
            <Trans
                i18nKey="merchantEdit.purchaseTracker.sheet.instructions.magento"
                components={{
                    italic: <i />,
                    doc: (
                        // biome-ignore lint/a11y/useAnchorContent: content injected by Trans
                        <a
                            href="https://packagist.org/packages/frak-labs/magento2-module"
                            target="_blank"
                            rel="noopener noreferrer"
                        />
                    ),
                }}
            />
        ),
        custom: (
            <Trans
                i18nKey="merchantEdit.purchaseTracker.sheet.instructions.custom"
                components={{
                    doc: (
                        // biome-ignore lint/a11y/useAnchorContent: content injected by Trans
                        <a
                            href="https://docs.frak.id/wallet-sdk/references-api/webhook#custom-webhook"
                            target="_blank"
                            rel="noopener noreferrer"
                        />
                    ),
                }}
            />
        ),
    }[platform];

    return (
        <RegistrationLayout
            intro={intro}
            webhookUrl={webhookUrl}
            signinKey={signinKey}
        >
            <p className={styles.instructions}>
                {t("merchantEdit.purchaseTracker.sheet.registerHint")}
            </p>
            <RegisterButton
                isPending={isPending}
                isUpdate={!!currentSigninKey}
                onClick={() =>
                    setupWebhook({ webhookKey: signinKey, platform })
                }
            />
        </RegistrationLayout>
    );
}

function ShopifyRegistrationForm({
    merchantId,
    currentSigninKey,
    webhookUrl,
}: {
    merchantId: string;
    currentSigninKey?: string;
    webhookUrl?: string;
}) {
    const { t } = useTranslation();
    const { mutate: setupWebhook, isPending } = useWebhookSetup({ merchantId });

    const form = useForm({
        values: useMemo(
            () => ({ key: currentSigninKey ?? "" }),
            [currentSigninKey]
        ),
        defaultValues: { key: currentSigninKey ?? "" },
    });

    const submit = form.handleSubmit(({ key }) =>
        setupWebhook({ webhookKey: key, platform: "shopify" })
    );

    return (
        <RegistrationLayout
            intro={
                <Trans
                    i18nKey="merchantEdit.purchaseTracker.sheet.instructions.shopify"
                    components={{ italic: <i /> }}
                />
            }
            webhookUrl={webhookUrl}
        >
            <Form {...form}>
                <form onSubmit={submit}>
                    <FormField
                        control={form.control}
                        name="key"
                        rules={{
                            required: t(
                                "merchantEdit.purchaseTracker.sheet.shopify.missingKey"
                            ),
                        }}
                        render={({ field }) => (
                            <EditField
                                label={t(
                                    "merchantEdit.purchaseTracker.sheet.shopify.keyLabel"
                                )}
                            >
                                <FormControl>
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        disabled={isPending}
                                        placeholder={t(
                                            "merchantEdit.purchaseTracker.sheet.shopify.keyPlaceholder"
                                        )}
                                        {...field}
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                </form>
            </Form>
            <RegisterButton
                isPending={isPending}
                isUpdate={!!currentSigninKey}
                type="button"
                onClick={() => submit()}
            />
        </RegistrationLayout>
    );
}

function InternalRegistration() {
    const { t } = useTranslation();

    return (
        <Stack space="m">
            <p className={styles.instructions}>
                {t("merchantEdit.purchaseTracker.sheet.instructions.internal1")}
            </p>
            <p className={styles.instructions}>
                {t("merchantEdit.purchaseTracker.sheet.instructions.internal2")}
            </p>
        </Stack>
    );
}

const formatDate = (date?: Date) =>
    date ? new Date(date).toLocaleString() : "N/A";

function StatsCard({
    stats,
}: {
    stats: {
        firstPurchase?: Date;
        lastPurchase?: Date;
        lastUpdate?: Date;
        totalPurchaseHandled?: number;
    };
}) {
    const { t } = useTranslation();

    const rows = [
        {
            key: "firstPurchase",
            label: t("merchantEdit.purchaseTracker.sheet.stats.firstPurchase"),
            value: formatDate(stats.firstPurchase),
        },
        {
            key: "lastPurchase",
            label: t("merchantEdit.purchaseTracker.sheet.stats.lastPurchase"),
            value: formatDate(stats.lastPurchase),
        },
        {
            key: "lastUpdate",
            label: t("merchantEdit.purchaseTracker.sheet.stats.lastUpdate"),
            value: formatDate(stats.lastUpdate),
        },
        {
            key: "total",
            label: t("merchantEdit.purchaseTracker.tracked"),
            value: String(stats.totalPurchaseHandled ?? 0),
        },
    ];

    return (
        <EditCard title={t("merchantEdit.purchaseTracker.sheet.stats.title")}>
            <div className={cells.detailCells}>
                {rows.map((row) => (
                    <div key={row.key} className={cells.detailCell}>
                        <span className={cells.cellLabel}>{row.label}</span>
                        <span className={cells.cellValue}>{row.value}</span>
                    </div>
                ))}
            </div>
        </EditCard>
    );
}
