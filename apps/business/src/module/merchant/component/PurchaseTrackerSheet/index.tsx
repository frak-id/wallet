import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { generatePrivateKey } from "viem/accounts";
import { Badge } from "@/module/common/component/Badge";
import { Button } from "@/module/common/component/Button";
import { TextWithCopy } from "@/module/common/component/TextWithCopy";
import { Form, FormLabel } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import {
    usePurchaseWebhookStatus,
    type WebhookPlatform,
    type WebhookStatus,
} from "@/module/merchant/hook/usePurchaseWebhookStatus";
import { useWebhookSetup } from "@/module/merchant/hook/useWebhookSetup";
import * as styles from "./purchase-tracker-sheet.css";

export function PurchaseTrackerSheet({ merchantId }: { merchantId: string }) {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="secondary">Update webhook</Button>
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>Purchase tracker</SheetTitle>
                    <SheetDescription>
                        Configure how Frak receives purchase events from your
                        store.
                    </SheetDescription>
                </SheetHeader>
                <PurchaseTrackerSheetBody merchantId={merchantId} />
                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="ghost">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

function PurchaseTrackerSheetBody({ merchantId }: { merchantId: string }) {
    const { data: webhookStatus, isLoading } = usePurchaseWebhookStatus({
        merchantId,
    });

    if (isLoading || !webhookStatus) {
        return <Spinner />;
    }

    return (
        <div className={styles.body}>
            <StatusSection status={webhookStatus} />
            <PlatformSection
                merchantId={merchantId}
                webhookStatus={webhookStatus}
            />
            {webhookStatus.setup && webhookStatus.stats && (
                <StatsSection stats={webhookStatus.stats} />
            )}
        </div>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h3 className={styles.sectionTitle}>{title}</h3>
            <div className={styles.sectionBody}>{children}</div>
        </div>
    );
}

function StatusSection({ status }: { status: WebhookStatus }) {
    return (
        <Section title="Status">
            <Inline space="m" alignY="bottom">
                <Badge variant={status.setup ? "success" : "warning"}>
                    {status.setup
                        ? "Webhook registered"
                        : "Webhook not registered"}
                </Badge>
                {status.setup && status.platform && (
                    <Badge variant={"secondary"}>{status.platform}</Badge>
                )}
            </Inline>
        </Section>
    );
}

function PlatformSection({
    merchantId,
    webhookStatus,
}: {
    merchantId: string;
    webhookStatus: WebhookStatus;
}) {
    const initialState: WebhookPlatform = webhookStatus.setup
        ? webhookStatus.platform
        : "shopify";
    const [currentPlatform, setCurrentPlatform] =
        useState<WebhookPlatform>(initialState);

    const webhookUrl = useMemo(() => {
        return `${process.env.BACKEND_URL}/ext/merchant/${merchantId}/webhook/purchases/${currentPlatform}`;
    }, [merchantId, currentPlatform]);

    return (
        <Section title="Purchase platform">
            <PlatformSelector
                currentPlatform={currentPlatform}
                setPlatform={setCurrentPlatform}
                isSetup={webhookStatus.setup}
            />
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
        </Section>
    );
}

function PlatformSelector({
    currentPlatform,
    setPlatform,
    isSetup,
}: {
    currentPlatform: WebhookPlatform;
    setPlatform: (platform: WebhookPlatform) => void;
    isSetup: boolean;
}) {
    const handlePlatformChange = (platform: WebhookPlatform) => {
        if (platform === currentPlatform) return;
        if (!isSetup) {
            setPlatform(platform);
            return;
        }

        const confirmSuffix =
            currentPlatform === "internal"
                ? "\n\nYou won't be able to revert back using this dashboard. You would need to go to the platform-specific application (like the Shopify Frak app) and set up the webhook again from there."
                : "";
        const hasConfirmed = window.confirm(
            `Warning\n\nAre you sure you want to change the platform?\nThis could potentially break your purchase tracking.${confirmSuffix}`
        );
        if (hasConfirmed) {
            setPlatform(platform);
        }
    };

    return (
        <Inline space="m" alignY="center">
            <Badge
                onClick={() => handlePlatformChange("shopify")}
                variant={
                    currentPlatform === "shopify" ? "success" : "secondary"
                }
            >
                Shopify
            </Badge>
            <Badge
                onClick={() => handlePlatformChange("woocommerce")}
                variant={
                    currentPlatform === "woocommerce" ? "success" : "secondary"
                }
            >
                WooCommerce
            </Badge>
            <Badge
                onClick={() => handlePlatformChange("magento")}
                variant={
                    currentPlatform === "magento" ? "success" : "secondary"
                }
            >
                Magento
            </Badge>
            <Badge
                onClick={() => handlePlatformChange("custom")}
                variant={currentPlatform === "custom" ? "success" : "secondary"}
            >
                Custom
            </Badge>
            <Badge
                variant={
                    currentPlatform === "internal" ? "success" : "secondary"
                }
                disabled
            >
                Internal
            </Badge>
        </Inline>
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
    if (platform === "woocommerce") {
        return (
            <WooCommerceRegistrationForm
                merchantId={merchantId}
                webhookUrl={webhookUrl}
                currentSigninKey={currentSigninKey}
            />
        );
    }

    if (platform === "magento") {
        return (
            <MagentoRegistrationForm
                merchantId={merchantId}
                webhookUrl={webhookUrl}
                currentSigninKey={currentSigninKey}
            />
        );
    }

    if (platform === "custom") {
        return (
            <CustomRegistrationForm
                merchantId={merchantId}
                webhookUrl={webhookUrl}
                currentSigninKey={currentSigninKey}
            />
        );
    }

    if (platform === "internal") {
        return <InternalRegistrationForm />;
    }

    return (
        <ShopifyRegistrationForm
            merchantId={merchantId}
            webhookUrl={webhookUrl}
            currentSigninKey={currentSigninKey}
        />
    );
}

function CustomRegistrationForm({
    merchantId,
    webhookUrl,
    currentSigninKey,
}: {
    merchantId: string;
    webhookUrl: string;
    currentSigninKey?: string;
}) {
    const { mutate: setupWebhook, isPending } = useWebhookSetup({ merchantId });

    const signinKey = useMemo(
        () => currentSigninKey ?? generatePrivateKey(),
        [currentSigninKey]
    );

    return (
        <>
            <p>
                To use this webhook on your website, please refer to the{" "}
                <a
                    href={
                        "https://docs.frak.id/wallet-sdk/api/endpoints/webhook#custom-webhook"
                    }
                    target={"_blank"}
                    rel="noopener noreferrer"
                >
                    Documentation
                </a>
            </p>
            <TextWithCopy text={webhookUrl}>
                URL: <pre>{webhookUrl}</pre>
            </TextWithCopy>
            <TextWithCopy text={signinKey}>
                Secret: <pre>{signinKey}</pre>
            </TextWithCopy>
            <p>And finally Register it on Frak via this button</p>
            <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                    setupWebhook({
                        webhookKey: signinKey,
                        platform: "custom",
                    });
                }}
            >
                {currentSigninKey ? "Update Webhook" : "Register webhook"}
            </Button>
        </>
    );
}

function WooCommerceRegistrationForm({
    merchantId,
    webhookUrl,
    currentSigninKey,
}: {
    merchantId: string;
    webhookUrl: string;
    currentSigninKey?: string;
}) {
    const { mutate: setupWebhook, isPending } = useWebhookSetup({ merchantId });

    const signinKey = useMemo(
        () => currentSigninKey ?? generatePrivateKey(),
        [currentSigninKey]
    );

    return (
        <>
            <p>
                To register the webhook on WooCommerce, go to your WordPress
                admin console, and then in
                <br />
                <i>
                    WooCommerce {">"} Settings {">"} Advanced {">"} Webhooks
                </i>
                <br />
                Create a new WebHook with the topic <i>Order Updated</i> with
                the following URL and Secret:
            </p>
            <TextWithCopy text={webhookUrl}>
                URL: <pre>{webhookUrl}</pre>
            </TextWithCopy>
            <TextWithCopy text={signinKey}>
                Secret: <pre>{signinKey}</pre>
            </TextWithCopy>
            <p>And finally Register it on Frak via this button</p>
            <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                    setupWebhook({
                        webhookKey: signinKey,
                        platform: "woocommerce",
                    });
                }}
            >
                {currentSigninKey ? "Update Webhook" : "Register webhook"}
            </Button>
        </>
    );
}

function MagentoRegistrationForm({
    merchantId,
    webhookUrl,
    currentSigninKey,
}: {
    merchantId: string;
    webhookUrl: string;
    currentSigninKey?: string;
}) {
    const { mutate: setupWebhook, isPending } = useWebhookSetup({ merchantId });

    const signinKey = useMemo(
        () => currentSigninKey ?? generatePrivateKey(),
        [currentSigninKey]
    );

    return (
        <>
            <p>
                To register the webhook on Adobe Commerce (Magento 2), install
                the{" "}
                <a
                    href={
                        "https://packagist.org/packages/frak-labs/magento2-module"
                    }
                    target={"_blank"}
                    rel="noopener noreferrer"
                >
                    frak-labs/magento2-module
                </a>{" "}
                Composer package, then go to your Magento admin console:
                <br />
                <i>
                    Stores {">"} Configuration {">"} Frak {">"} Webhook Secret
                </i>
                <br />
                Paste the secret below into the Webhook Secret field.
            </p>
            <TextWithCopy text={webhookUrl}>
                URL: <pre>{webhookUrl}</pre>
            </TextWithCopy>
            <TextWithCopy text={signinKey}>
                Secret: <pre>{signinKey}</pre>
            </TextWithCopy>
            <p>And finally Register it on Frak via this button</p>
            <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                    setupWebhook({
                        webhookKey: signinKey,
                        platform: "magento",
                    });
                }}
            >
                {currentSigninKey ? "Update Webhook" : "Register webhook"}
            </Button>
        </>
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
    const { mutate: setupWebhook, isPending } = useWebhookSetup({ merchantId });
    const [error, setError] = useState<string | undefined>();

    const form = useForm({
        values: useMemo(() => ({ key: currentSigninKey }), [currentSigninKey]),
        defaultValues: {
            key: currentSigninKey,
        },
    });

    return (
        <>
            <p>
                To register the webhook on Shopify, go to your Shopify admin
                console, and then in <br />
                <i>
                    Settings {">"} Notifications {">"} WebHook
                </i>
                <br />
                Create a new WebHook with the event <i>Order Updated</i> with
                the following URL:
            </p>
            <TextWithCopy text={webhookUrl}>
                URL: <pre>{webhookUrl}</pre>
            </TextWithCopy>
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit((values) => {
                        const { key } = values;
                        setError(undefined);
                        if (!key || key === "") {
                            setError("Missing signin key");
                            return;
                        }
                        setupWebhook({ webhookKey: key, platform: "shopify" });
                    })}
                >
                    <FormLabel weight={"medium"} htmlFor={"webhook-signin-key"}>
                        Copy the signature in the bottom of the webhooks list
                        from your shopify panel
                    </FormLabel>
                    <Input
                        id={"webhook-signin-key"}
                        length={"medium"}
                        disabled={isPending}
                        placeholder="Webhook signin key"
                        {...form.register("key")}
                    />
                    {error && <p className={"error"}>{error}</p>}
                    <Button
                        type="submit"
                        variant="secondary"
                        disabled={isPending}
                    >
                        {currentSigninKey
                            ? "Update webhook"
                            : "Register webhook"}
                    </Button>
                </form>
            </Form>
        </>
    );
}

function InternalRegistrationForm() {
    return (
        <>
            <p>
                Your merchant is already registered on Frak using an internal
                webhook. <br />
                This could be because you are using one of our third parties
                application like the Shopify app, or the WordPress plugin.
            </p>
            <p>
                If you think that's a mistake, you can switch to a manual setup
                using the selector on top.
            </p>
        </>
    );
}

function StatsSection({
    stats,
}: {
    stats: {
        firstPurchase?: Date;
        lastPurchase?: Date;
        lastUpdate?: Date;
        totalPurchaseHandled?: number;
    };
}) {
    return (
        <Section title="Stats">
            <Row
                label="First purchase"
                value={stats.firstPurchase?.toString() ?? "N/A"}
            />
            <Row
                label="Last purchase"
                value={stats.lastPurchase?.toString() ?? "N/A"}
            />
            <Row
                label="Last update"
                value={stats.lastUpdate?.toString() ?? "N/A"}
            />
            <Row
                label="Total purchases handled"
                value={String(stats.totalPurchaseHandled ?? 0)}
            />
        </Section>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.labelRow}>
            <span className={styles.labelText}>{label}</span>
            <span className={styles.valueText}>{value}</span>
        </div>
    );
}
