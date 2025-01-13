import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
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

export function WebhookInteraction({ productId }: { productId: Hex }) {
    // Show success message
    const [success, _setSuccess] = useState(false);

    // Current webhook url and signinKey to setup
    const webhookUrl = useMemo(() => {
        return `${process.env.BACKEND_URL}/interactions/${productId}`;
    }, [productId]);

    // The key that will be used for webhook
    const signinKey = useMemo(() => {
        return generatePrivateKey();
    }, []);

    return (
        <>
            <Columns>
                <Column size={"full"} style={{ width: "100%" }}>
                    <Title as={"h3"}>Status</Title>
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
                <Column>{success && <ActionsMessageSuccess />}</Column>
                <Column>
                    <Button variant={"submit"}>Save</Button>
                </Column>
            </Columns>
        </>
    );
}
