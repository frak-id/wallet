import { Panel } from "@/module/common/component/Panel";
import type { SendInteractionReturnType } from "@frak-labs/core-sdk";
import { PressInteractionEncoder } from "@frak-labs/core-sdk/interactions";
import { useSendInteraction } from "@frak-labs/react-sdk";
import { Button } from "@module/component/Button";
import { BadgeCheck } from "lucide-react";
import { generatePrivateKey } from "viem/accounts";

export function SendInteraction() {
    const {
        mutate: sendInteraction,
        data,
        error,
        status,
        isPending,
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
                        interaction: PressInteractionEncoder.readArticle({
                            articleId: generatePrivateKey(),
                        }),
                        productId:
                            "0x4b1115a4946079f8d83c63061f5c49c2f351a054d8dfb284b197f54dbfa8ed62",
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

function InteractionResult({ data }: { data: SendInteractionReturnType }) {
    return (
        <div>
            <h4>
                <BadgeCheck />
                Interaction pushed with success
            </h4>

            <p>DelegationId: {data.delegationId}</p>
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
