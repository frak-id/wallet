import { Panel } from "@/module/common/component/Panel";
import {
    addresses,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import type {
    LoginModalStepType,
    ModalRpcStepsResultType,
    SendTransactionModalStepType,
    SiweAuthenticateModalStepType,
} from "@frak-labs/core-sdk";
import type { OpenInteractionSessionModalStepType } from "@frak-labs/core-sdk";
import { useDisplayModal } from "@frak-labs/react-sdk";
import { Button } from "@module/component/Button";
import { BadgeCheck } from "lucide-react";
import { useMemo } from "react";
import { encodeFunctionData } from "viem";
import { parseSiweMessage } from "viem/siwe";

export function FullDialog() {
    const {
        mutate: displayModal,
        data,
        error,
        status,
        isPending,
    } = useDisplayModal();

    return (
        <Panel variant={"primary"}>
            <h2>Full Dialog</h2>

            <p>
                When the btn is clicked, the SDK will ask the Frak Wallet to
                perform all the available actions
            </p>
            <br />

            <p>Actions state: {status}</p>
            <br />

            <Button
                onClick={() =>
                    displayModal({
                        steps: {
                            siweAuthenticate: {
                                metadata: {
                                    title: "EthCC SIWE",
                                },
                                siwe: {
                                    domain: "example.com",
                                    uri: "https://wallet.frak.id/",
                                    statement: "Please authenticate",
                                    nonce: "0123456789",
                                    version: "1",
                                },
                            },
                            sendTransaction: {
                                metadata: {
                                    title: "EthCC Transaction",
                                },
                                tx: {
                                    to: addresses.productInteractionManager,
                                    value: "0x00",
                                    data: encodeFunctionData({
                                        abi: productInteractionManagerAbi,
                                        functionName: "getInteractionContract",
                                        args: [
                                            106219508196454080375526586478153583586194937194493887259467424694676997453395n,
                                        ],
                                    }),
                                },
                            },
                            openSession: {},
                            login: {
                                allowSso: true,
                                ssoMetadata: {
                                    homepageLink: "https://frak.id/",
                                    logoUrl:
                                        "https://pbs.twimg.com/profile_images/1593655640643305474/aTQ98ZdJ_400x400.jpg",
                                },
                            },
                        },
                    })
                }
                type={"button"}
                disabled={isPending}
            >
                Let's gooo
            </Button>
            <br />

            {data && <ActionResult data={data} />}

            {error && <ActionError error={error} />}
        </Panel>
    );
}

// Display the authentication result well formatted
function ActionResult({
    data,
}: {
    data: ModalRpcStepsResultType<
        [
            LoginModalStepType,
            OpenInteractionSessionModalStepType,
            SiweAuthenticateModalStepType,
            SendTransactionModalStepType,
        ]
    >;
}) {
    const siweData = useMemo(() => {
        return parseSiweMessage(data.siweAuthenticate.message);
    }, [data.siweAuthenticate.message]);

    return (
        <>
            <h4>
                <BadgeCheck />
                Action success
            </h4>

            <h5>Login data</h5>
            <p>Address: {data.login.wallet}</p>
            <hr />

            <h5>Open session data</h5>
            <p>Session start: {data.openSession.startTimestamp}</p>
            <p>Session end: {data.openSession.endTimestamp}</p>
            <hr />

            <h5>Siwe data</h5>
            <p>Address: {siweData?.address}</p>
            <p>Domain: {siweData?.domain}</p>
            <p>URI: {siweData?.uri}</p>
            <p>Statement: {siweData?.statement}</p>

            <p>Signature: {data.siweAuthenticate.signature}</p>

            <hr />
            <h5>Send transaction data</h5>
            <p>Transaction hash: {data.sendTransaction.hash}</p>
        </>
    );
}

function ActionError({ error }: { error: Error }) {
    return (
        <div>
            <h4>Error when performing the action</h4>

            <p>{error.message}</p>
        </div>
    );
}
