"use client";

import { Panel } from "@/module/common/component/Panel";
import { useSiweAuthenticate } from "@frak-labs/nexus-sdk/react";
import { Button } from "@module/component/Button";
import type {SiweAuthenticateReturnType} from "@frak-labs/nexus-sdk/dist/core";
import {useMemo} from "react";
import {parseSiweMessage} from "viem/siwe";
import {BadgeCheck} from "lucide-react";

export function WalletLogin() {
    const {
        mutate: authenticate,
        data,
        error,
        status
    } = useSiweAuthenticate();

    return (
        <Panel variant={"primary"}>
            <h2>SIWE Authentication</h2>

            <p>On click on authentication, the SDK will ask the Nexus Wallet to sign a SIWE Authentication message.</p>
            <p>The SDK will return the signature, and the full message, to help the caller verify the validity of the
                message.</p>
            <br/>

            <p>Authentication state: {status}</p>
            <br/>

            <Button onClick={() => authenticate({})} type={"button"} disabled={status !== "idle"}>
                Authenticate
            </Button>
            <br/>

            {data && (
                <AuthenticationResult data={data}/>
            )}

            {error && (
                <AuthenticationError error={error}/>
            )}
        </Panel>
    );
}

// Display the authentication result well formatted
function AuthenticationResult ({ data }: { data: Extract<SiweAuthenticateReturnType, { key: "success"}>}) {
    const siweData = useMemo(() => {
        return parseSiweMessage(data.message);
    }, [data.message]);

    return (
        <div>
            <h4><BadgeCheck/>Authentication success</h4>

            <p>Address: {siweData.address}</p>
            <p>Domain: {siweData.domain}</p>
            <p>URI: {siweData.uri}</p>
            <p>Statement: {siweData.statement}</p>

            <p>Signature: {data.signature}</p>
        </div>
    );
}

function AuthenticationError ({ error }: { error: Error}) {
    return (
        <div>
            <h4>Authentication error</h4>

            <p>{error.message}</p>
        </div>
    );
}