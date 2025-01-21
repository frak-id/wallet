import {
    ActionsMessageError,
    ActionsMessageSuccess,
} from "@/module/campaigns/component/Actions";
import { Badge } from "@/module/common/component/Badge";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { useWebhookInteractionDelete } from "@/module/product/hook/useWebhookInteractionDelete";
import { useWebhookInteractionSetup } from "@/module/product/hook/useWebhookInteractionSetup";
import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";
import { AlertDialog } from "@module/component/AlertDialog";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { Spinner } from "@module/component/Spinner";
import { TextWithCopy } from "@module/component/TextWithCopy";
import { useMemo, useState } from "react";
import type { Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";
import styles from "./WebhookInteraction.module.css";

/**
 * Setup for the Webhook interaction
 */
export function WebhookInteractionSetup({ productId }: { productId: Hex }) {
    return (
        <PanelAccordion title="Webhook Interaction" id={"purchaseTracker"}>
            <p className={styles.purchaseTracker__description}>
                The Webhook interaction will permit to create campaigns and
                distribute rewards based on user purchase on your website.
            </p>
            <WebhookInteractionAccordionContent productId={productId} />
        </PanelAccordion>
    );
}

/**
 * The content of the accordion
 */
function WebhookInteractionAccordionContent({ productId }: { productId: Hex }) {
    return (
        <div className={styles.purchaseTrackerAccordionContent}>
            <WebhookInteraction productId={productId} />
        </div>
    );
}

function WebhookInteraction({ productId }: { productId: Hex }) {
    // Fetch some data about the current webhook interaction setup
    const { data: webhookInteractionStatus, isLoading } =
        useWebhookInteractionStatus({
            productId,
        });

    const {
        mutateAsync: setupWebhookInteraction,
        isSuccess: successWebhookInteraction,
        isPending: pendingWebhookInteraction,
        isError: isErrorWebhookInteraction,
        reset: resetWebhookInteraction,
    } = useWebhookInteractionSetup({ productId });
    // Current webhook url and signinKey to setup
    const webhookUrl = useMemo(() => {
        return `${process.env.BACKEND_URL}/interactions/webhook/${productId}/pushRaw`;
    }, [productId]);

    // The key that will be used for webhook
    const signinKey = useMemo(() => {
        if (webhookInteractionStatus?.webhookSigninKey) {
            return webhookInteractionStatus?.webhookSigninKey;
        }

        return generatePrivateKey();
    }, [webhookInteractionStatus?.webhookSigninKey]);

    if (isLoading) {
        return <Spinner />;
    }

    return (
        <>
            <Columns>
                <Column size={"full"} style={{ width: "100%" }}>
                    <Title as={"h3"}>Status </Title>
                    <p>
                        <Badge
                            variant={
                                webhookInteractionStatus?.setup
                                    ? "success"
                                    : "warning"
                            }
                        >
                            {webhookInteractionStatus?.setup
                                ? "Setup"
                                : "Not setup"}
                        </Badge>
                    </p>
                </Column>
            </Columns>

            <Columns>
                <Column size={"full"} style={{ width: "100%" }}>
                    <Title as={"h3"}>Webhook source</Title>

                    <TextWithCopy text={webhookUrl} style={{ width: "100%" }}>
                        URL: <pre>{webhookUrl}</pre>
                    </TextWithCopy>
                    <TextWithCopy text={signinKey} style={{ width: "100%" }}>
                        Secret: <pre>{signinKey}</pre>
                    </TextWithCopy>
                </Column>
            </Columns>

            <Columns>
                <Column>
                    {successWebhookInteraction && <ActionsMessageSuccess />}
                    {isErrorWebhookInteraction && <ActionsMessageError />}
                    {webhookInteractionStatus?.setup && (
                        <ModalDelete
                            productId={productId}
                            resetWebhookInteraction={resetWebhookInteraction}
                        />
                    )}
                </Column>
                <Column>
                    {!webhookInteractionStatus?.setup && (
                        <Button
                            variant={"submit"}
                            disabled={pendingWebhookInteraction}
                            isLoading={pendingWebhookInteraction}
                            onClick={() =>
                                setupWebhookInteraction({
                                    productId,
                                    hookSignatureKey: signinKey,
                                })
                            }
                        >
                            Save
                        </Button>
                    )}
                </Column>
            </Columns>
        </>
    );
}

/**
 * Component representing the delete modal for the webhook interaction
 * @param productId
 * @param resetWebhookInteraction
 * @constructor
 */
function ModalDelete({
    productId,
    resetWebhookInteraction,
}: { productId: Hex; resetWebhookInteraction: () => void }) {
    const {
        mutateAsync: deleteWebhook,
        isPending: isDeleting,
        isError,
    } = useWebhookInteractionDelete({
        productId,
    });
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Delete Webhook Interaction"}
            buttonElement={
                <Button
                    variant={"danger"}
                    className={styles.interactionSettings__button}
                >
                    Delete Webhook
                </Button>
            }
            description={<>Are you sure you want to delete the Webhook?</>}
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"danger"}
                    isLoading={isDeleting}
                    disabled={isDeleting}
                    onClick={async () => {
                        resetWebhookInteraction();
                        await deleteWebhook({ productId });
                        setOpen(false);
                    }}
                >
                    Delete
                </Button>
            }
        />
    );
}
