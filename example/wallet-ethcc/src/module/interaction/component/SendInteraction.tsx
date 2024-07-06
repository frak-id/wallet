"use client";

import { Panel } from "@/module/common/component/Panel";
import type { SendInteractionReturnType } from "@frak-labs/nexus-sdk/core";
import { PressInteractionEncoder } from "@frak-labs/nexus-sdk/interactions";
import { useSendInteraction } from "@frak-labs/nexus-sdk/react";
import { Button } from "@module/component/Button";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import {toHex} from "viem";

export function SendInteraction() {
    const {
        mutate: sendInteraction,
        data,
        error,
        status,
        isPending
    } = useSendInteraction();

    return (
        <Panel variant={"primary"}>
            <h2>Submit user interaction via session</h2>

            <p>
                When the btn is clicked, we will simulate a user interaction (in
                our case, user opening an article)
            </p>
            <br />

            <p>Pushing interaction state: {status}</p>
            <br />

            <Button
                onClick={() =>
                    sendInteraction({
                        contentId: toHex(106219508196454080375526586478153583586194937194493887259467424694676997453395n),
                        interaction: PressInteractionEncoder.openArticle({
                            articleId: "0xdeadbeef",
                        }),
                    })
                }
                type={"button"}
                disabled={isPending}
            >
                Push interaction
            </Button>
            <br />

            {data && <InteractionResult data={data} />}

            {error && <InteractionError error={error} />}
        </Panel>
    );
}

// Display the authentication result well formatted
function InteractionResult({
    data,
}: { data: Extract<SendInteractionReturnType, { key: "success" }> }) {
    return (
        <div>
            <h4>
                <BadgeCheck />
                Interaction pushed with success
            </h4>

            <p>TxHash: {data.hash}</p>
            <Link
                href={`https://sepolia.arbiscan.io/tx/${data.hash}`}
                target={"_blank"}
            >
                View on arbiscan
            </Link>
        </div>
    );
}

function InteractionError({ error }: { error: Error }) {
    return (
        <div>
            <h4>Interaction error</h4>

            <p>{error.message}</p>
        </div>
    );
}
