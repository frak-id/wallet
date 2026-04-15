import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { TextWithCopy } from "@frak-labs/ui/component/TextWithCopy";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { generatePrivateKey } from "viem/accounts";
import { authenticatedBackendApi } from "@/api/backendClient";
import { Badge } from "@/module/common/component/Badge";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { Form, FormLabel } from "@/module/forms/Form";
import {
    usePurchaseWebhookStatus,
    type WebhookPlatform,
} from "@/module/merchant/hook/usePurchaseWebhookStatus";

export function PurchaseTrackerWebhook({ merchantId }: { merchantId: string }) {
    const { data: webhookStatus } = usePurchaseWebhookStatus({
        merchantId,
    });

    const initialState = useMemo(() => {
        if (webhookStatus?.setup) {
            return webhookStatus.platform;
        }

        return "shopify";
    }, [webhookStatus]);

    const [currentPlatform, setCurrentPlatform] =
        useState<WebhookPlatform>(initialState);
    const webhookUrl = useMemo(() => {
        return `${process.env.BACKEND_URL}/ext/merchant/${merchantId}/webhook/purchases/${currentPlatform}`;
    }, [merchantId, currentPlatform]);

    if (!webhookStatus) {
        return <Spinner />;
    }

    return (
        <>
            <Columns>
                <Column size={"full"} style={{ width: "100%" }}>
                    <Title as={"h3"}>Status</Title>
                    <Row>
                        <Badge
                            variant={
                                webhookStatus.setup ? "success" : "warning"
                            }
                        >
                            {webhookStatus.setup
                                ? "Webhook registered"
                                : "Webhook not registered"}
                        </Badge>
                        {webhookStatus.setup && webhookStatus.platform && (
                            <Badge variant={"information"}>
                                {webhookStatus.platform}
                            </Badge>
                        )}
                    </Row>
                </Column>
            </Columns>

            <Columns>
                <Column size={"full"} style={{ width: "100%" }}>
                    <Title as={"h3"}>Purchase platform</Title>

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
                </Column>
            </Columns>
        </>
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
            return;
        }
    };

    return (
        <Row align="center">
            <Badge
                onClick={() => handlePlatformChange("shopify")}
                variant={
                    currentPlatform === "shopify" ? "success" : "secondary"
                }
                style={{ cursor: "pointer" }}
            >
                Shopify
            </Badge>
            <Badge
                onClick={() => handlePlatformChange("woocommerce")}
                variant={
                    currentPlatform === "woocommerce" ? "success" : "secondary"
                }
                style={{ cursor: "pointer" }}
            >
                WooCommerce
            </Badge>
            <Badge
                onClick={() => handlePlatformChange("magento")}
                variant={
                    currentPlatform === "magento" ? "success" : "secondary"
                }
                style={{ cursor: "pointer" }}
            >
                Magento
            </Badge>
            <Badge
                onClick={() => handlePlatformChange("custom")}
                variant={currentPlatform === "custom" ? "success" : "secondary"}
                style={{ cursor: "pointer" }}
            >
                Custom
            </Badge>
            <Badge
                variant={
                    currentPlatform === "internal" ? "success" : "secondary"
                }
                style={{ cursor: "not-allowed" }}
            >
                Internal
            </Badge>
        </Row>
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
    const { mutate: setupWebhook, isPending } = useWebhookSetup({
        merchantId,
    });

    const signinKey = useMemo(() => {
        if (currentSigninKey) {
            return currentSigninKey;
        }

        return generatePrivateKey();
    }, [currentSigninKey]);

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
            <TextWithCopy text={webhookUrl} style={{ width: "100%" }}>
                URL: <pre>{webhookUrl}</pre>
            </TextWithCopy>
            <TextWithCopy text={signinKey} style={{ width: "100%" }}>
                Secret: <pre>{signinKey}</pre>
            </TextWithCopy>
            <p>And finally Register it on Frak via this button</p>
            <Button
                type="button"
                variant="information"
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
    const { mutate: setupWebhook, isPending } = useWebhookSetup({
        merchantId,
    });

    const signinKey = useMemo(() => {
        if (currentSigninKey) {
            return currentSigninKey;
        }

        return generatePrivateKey();
    }, [currentSigninKey]);

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
            <TextWithCopy text={webhookUrl} style={{ width: "100%" }}>
                URL: <pre>{webhookUrl}</pre>
            </TextWithCopy>
            <TextWithCopy text={signinKey} style={{ width: "100%" }}>
                Secret: <pre>{signinKey}</pre>
            </TextWithCopy>
            <p>And finally Register it on Frak via this button</p>
            <Button
                type="button"
                variant="information"
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
    const { mutate: setupWebhook, isPending } = useWebhookSetup({
        merchantId,
    });

    const signinKey = useMemo(() => {
        if (currentSigninKey) {
            return currentSigninKey;
        }

        return generatePrivateKey();
    }, [currentSigninKey]);

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
            <TextWithCopy text={webhookUrl} style={{ width: "100%" }}>
                URL: <pre>{webhookUrl}</pre>
            </TextWithCopy>
            <TextWithCopy text={signinKey} style={{ width: "100%" }}>
                Secret: <pre>{signinKey}</pre>
            </TextWithCopy>
            <p>And finally Register it on Frak via this button</p>
            <Button
                type="button"
                variant="information"
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
            <TextWithCopy text={webhookUrl} style={{ width: "100%" }}>
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
                        variant="information"
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

function useWebhookSetup({ merchantId }: { merchantId: string }) {
    const { refetch } = usePurchaseWebhookStatus({ merchantId });
    return useMutation({
        mutationKey: ["merchant", "webhook", "setup", merchantId],
        mutationFn: async ({
            webhookKey,
            platform,
        }: {
            webhookKey: string;
            platform: WebhookPlatform;
        }) => {
            await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.post({
                    hookSignatureKey: webhookKey,
                    platform,
                });
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
