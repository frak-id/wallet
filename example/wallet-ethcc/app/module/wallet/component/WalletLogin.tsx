import { Panel } from "@/module/common/component/Panel";
import type {
    LoginModalStepType,
    ModalRpcStepsResultType,
    SiweAuthenticateModalStepType,
} from "@frak-labs/core-sdk";
import { useDisplayModal } from "@frak-labs/react-sdk";
import { Button } from "@shared/module/component/Button";
import { BadgeCheck } from "lucide-react";
import { useMemo } from "react";
import { parseSiweMessage } from "viem/siwe";

export function WalletLogin() {
    const {
        mutate: displayModal,
        data,
        error,
        status,
        isPending,
    } = useDisplayModal();

    return (
        <Panel variant={"primary"}>
            <h2>SIWE Authentication</h2>

            <p>
                When the btn is clicked, the SDK will ask the Frak Wallet to
                sign a SIWE Authentication message.
            </p>
            <p>
                The SDK will return the signature, and the full message, to help
                the caller verify the validity of the message.
            </p>
            <br />

            <p>Authentication state: {status}</p>
            <br />

            <Button
                onClick={() =>
                    displayModal({
                        steps: {
                            login: {},
                            siweAuthenticate: {
                                siwe: {
                                    domain: "example.com",
                                    uri: "https://ethcc.news-paper.xyz/",
                                    statement: "Please authenticate",
                                    nonce: "0123456789",
                                    version: "1",
                                },
                            },
                        },
                    })
                }
                type={"button"}
                disabled={isPending}
            >
                Authenticate
            </Button>
            <br />

            {data && <AuthenticationResult data={data} />}

            {error && <AuthenticationError error={error} />}
        </Panel>
    );
}

// Display the authentication result well formatted
function AuthenticationResult({
    data,
}: {
    data: ModalRpcStepsResultType<
        [LoginModalStepType, SiweAuthenticateModalStepType]
    >;
}) {
    const siweData = useMemo(() => {
        return parseSiweMessage(data.siweAuthenticate.message);
    }, [data.siweAuthenticate.message]);

    return (
        <>
            <h4>
                <BadgeCheck />
                Authentication success
            </h4>

            <p>Address: {siweData?.address}</p>
            <p>Domain: {siweData?.domain}</p>
            <p>URI: {siweData?.uri}</p>
            <p>Statement: {siweData?.statement}</p>

            <p>Signature: {data.siweAuthenticate.signature}</p>
        </>
    );
}

function AuthenticationError({ error }: { error: Error }) {
    return (
        <div>
            <h4>Authentication error</h4>

            <p>{error.message}</p>
        </div>
    );
}
