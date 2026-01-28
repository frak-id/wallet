import { AlertDialog } from "@frak-labs/ui/component/AlertDialog";
import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { TextWithCopy } from "@frak-labs/ui/component/TextWithCopy";
import { useMemo, useState } from "react";
import { generatePrivateKey } from "viem/accounts";
import {
    ActionsMessageError,
    ActionsMessageSuccess,
} from "@/module/campaigns/component/Actions";
import { Badge } from "@/module/common/component/Badge";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { useWebhookInteractionDelete } from "@/module/merchant/hook/useWebhookInteractionDelete";
import { useWebhookInteractionSetup } from "@/module/merchant/hook/useWebhookInteractionSetup";
import { useWebhookInteractionStatus } from "@/module/merchant/hook/useWebhookInteractionStatus";
import styles from "./WebhookInteraction.module.css";

export function WebhookInteractionSetup({
    merchantId,
}: {
    merchantId: string;
}) {
    return (
        <PanelAccordion title="Webhook Interaction" id={"purchaseTracker"}>
            <p className={styles.purchaseTracker__description}>
                The Webhook interaction will permit to create campaigns and
                distribute rewards based on user purchase on your website.
            </p>
            <WebhookInteractionAccordionContent merchantId={merchantId} />
        </PanelAccordion>
    );
}

function WebhookInteractionAccordionContent({
    merchantId,
}: {
    merchantId: string;
}) {
    return (
        <div className={styles.purchaseTrackerAccordionContent}>
            <WebhookInteraction merchantId={merchantId} />
        </div>
    );
}

function WebhookInteraction({ merchantId }: { merchantId: string }) {
    const { data: webhookInteractionStatus, isLoading } =
        useWebhookInteractionStatus({
            merchantId,
        });

    const {
        mutateAsync: setupWebhookInteraction,
        isSuccess: successWebhookInteraction,
        isPending: pendingWebhookInteraction,
        isError: isErrorWebhookInteraction,
        reset: resetWebhookInteraction,
    } = useWebhookInteractionSetup({ merchantId });

    const webhookUrl = useMemo(() => {
        return `${process.env.BACKEND_URL}/ext/merchant/${merchantId}/webhook/purchases`;
    }, [merchantId]);

    const signinKey = useMemo(() => {
        if (webhookInteractionStatus?.setup) {
            return webhookInteractionStatus?.webhookSigninKey;
        }

        return generatePrivateKey();
    }, [webhookInteractionStatus]);

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
                            merchantId={merchantId}
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

function ModalDelete({
    merchantId,
    resetWebhookInteraction,
}: {
    merchantId: string;
    resetWebhookInteraction: () => void;
}) {
    const {
        mutateAsync: deleteWebhook,
        isPending: isDeleting,
        isError,
    } = useWebhookInteractionDelete({
        merchantId,
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
                        await deleteWebhook();
                        setOpen(false);
                    }}
                >
                    Delete
                </Button>
            }
        />
    );
}
