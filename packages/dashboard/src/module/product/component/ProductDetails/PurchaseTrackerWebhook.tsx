import { Badge } from "@/module/common/component/Badge";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { Form, FormLabel } from "@/module/forms/Form";
import { backendApi } from "@frak-labs/shared/context/server";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { Spinner } from "@module/component/Spinner";
import { TextWithCopy } from "@module/component/TextWithCopy";
import { Input } from "@module/component/forms/Input";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { useOracleSetupData } from "../../hook/useOracleSetupData";

type OraclePlatform = "shopify" | "woocommerce" | "custom";

export function PurchaseTrackerWebhook({ productId }: { productId: Hex }) {
    // Fetch some data about the current oracle setup
    const { data: oracleSetupData } = useOracleSetupData({
        productId,
    });

    // Current platform and webhook url to setup
    const [currentPlatform, setCurrentPlatform] = useState<OraclePlatform>(
        oracleSetupData?.webhookStatus?.platform ?? "shopify"
    );
    const webhookUrl = useMemo(() => {
        return `${process.env.BACKEND_URL}/oracle/${currentPlatform}/${productId}/hook`;
    }, [productId, currentPlatform]);

    if (!oracleSetupData) {
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
                                oracleSetupData.isWebhookSetup
                                    ? "success"
                                    : "warning"
                            }
                        >
                            {oracleSetupData.isWebhookSetup
                                ? "Webhook registered"
                                : "Webhook not registered"}
                        </Badge>
                        {oracleSetupData.webhookStatus?.setup &&
                            oracleSetupData?.webhookStatus?.platform && (
                                <Badge variant={"information"}>
                                    {oracleSetupData?.webhookStatus?.platform}
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
                    />

                    <PlatformRegistration
                        platform={currentPlatform}
                        webhookUrl={webhookUrl}
                        productId={productId}
                        currentSigninKey={
                            oracleSetupData.webhookStatus?.setup
                                ? oracleSetupData.webhookStatus.webhookSigninKey
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
}: {
    currentPlatform: OraclePlatform;
    setPlatform: (platform: OraclePlatform) => void;
}) {
    return (
        <Row align="center">
            <Badge
                onClick={() => setPlatform("shopify")}
                variant={
                    currentPlatform === "shopify" ? "success" : "secondary"
                }
                style={{ cursor: "pointer" }}
            >
                Shopify
            </Badge>
            <Badge
                onClick={() => setPlatform("woocommerce")}
                variant={
                    currentPlatform === "woocommerce" ? "success" : "secondary"
                }
                style={{ cursor: "pointer" }}
            >
                WooCommerce
            </Badge>
        </Row>
    );
}

function PlatformRegistration({
    platform,
    webhookUrl,
    productId,
    currentSigninKey,
}: {
    platform: OraclePlatform;
    webhookUrl: string;
    productId: Hex;
    currentSigninKey?: string;
}) {
    if (platform === "woocommerce") {
        return (
            <WooCommerceRegistrationForm
                productId={productId}
                webhookUrl={webhookUrl}
                currentSigninKey={currentSigninKey}
            />
        );
    }

    return (
        <StripeRegistrationForm
            productId={productId}
            webhookUrl={webhookUrl}
            currentSigninKey={currentSigninKey}
        />
    );
}

function WooCommerceRegistrationForm({
    productId,
    webhookUrl,
    currentSigninKey,
}: {
    productId: Hex;
    webhookUrl: string;
    currentSigninKey?: string;
}) {
    const { mutate: setupWebhook, isPending } = useWebhookSetup({
        productId,
    });

    // The key that will be used for the woocommerce webhook
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

function StripeRegistrationForm({
    productId,
    currentSigninKey,
    webhookUrl,
}: {
    productId: Hex;
    currentSigninKey?: string;
    webhookUrl?: string;
}) {
    const { mutate: setupWebhook, isPending } = useWebhookSetup({ productId });

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

function useWebhookSetup({ productId }: { productId: Hex }) {
    const { refetch } = useOracleSetupData({ productId });
    return useMutation({
        mutationKey: ["product", "oracle-webhook", "setup", productId],
        mutationFn: async ({
            webhookKey,
            platform,
        }: { webhookKey: string; platform: OraclePlatform }) => {
            await backendApi
                .oracle({ productId })
                .setup.post({ hookSignatureKey: webhookKey, platform });
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
