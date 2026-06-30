import { useDisplayModal } from "@frak-labs/react-sdk";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";

/**
 * Demo for the modal `final` step — logs the user in, then shows the final
 * step in either the `reward` (primary dismiss) or `sharing` (share/copy)
 * variant.
 */
export function FinalStep() {
    const { mutate: displayModal, status, isPending } = useDisplayModal();

    return (
        <Panel>
            <h2>Final step</h2>
            <p>
                On click, the SDK logs the user in then shows the modal{" "}
                <code>final</code> step.
            </p>
            <br />
            <p>Final step state: {status}</p>
            <br />
            <Button
                type={"button"}
                disabled={isPending}
                onClick={() =>
                    displayModal({
                        steps: {
                            login: { allowSso: true },
                            final: { action: { key: "reward" } },
                        },
                    })
                }
            >
                Final — reward
            </Button>{" "}
            <Button
                type={"button"}
                disabled={isPending}
                onClick={() =>
                    displayModal({
                        steps: {
                            login: { allowSso: true },
                            final: { action: { key: "sharing" } },
                        },
                    })
                }
            >
                Final — sharing
            </Button>
        </Panel>
    );
}
