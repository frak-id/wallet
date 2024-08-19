"use client";

import { rpId } from "@/context/wallet/smartWallet/webAuthN";
import {
    currentSsoMetadataAtom,
    ssoContextAtom,
} from "@/module/authentication/atoms/sso";
import styles from "@/module/authentication/component/Login/index.module.css";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { useAddToHomeScreenPrompt } from "@/module/common/hook/useAddToHomeScreenPrompt";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import { jotaiStore } from "@module/atoms/store";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { startAuthentication } from "@simplewebauthn/browser";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai/index";
import { CloudUpload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * The SSO page itself
 * @constructor
 */
export function Sso() {
    /**
     * The current metadata
     */
    const currentMetadata = useAtomValue(currentSsoMetadataAtom);

    /**
     * The success state after login or register
     */
    const [success, setSuccess] = useState(false);

    /**
     * The PWA prompt and installed state
     */
    const { prompt, isInstalled } = useAddToHomeScreenPrompt();

    /**
     * Redirect to the wallet's homepage if the app is installed
     */
    useMemo(() => {
        if (isInstalled && process.env.APP_URL) {
            window.location.href = process.env.APP_URL;
        }
    }, [isInstalled]);

    /**
     * Get the search params and set stuff in the sso context
     */
    const searchParams = useSearchParams();

    /**
     * Set the sso context atom directly
     */
    useEffect(() => {
        const productId = searchParams.get("productId");
        const redirectUrl = searchParams.get("redirectUrl");
        const directExit = searchParams.get("directExit");

        jotaiStore.set(ssoContextAtom, {
            productId: productId ?? undefined,
            redirectUrl: redirectUrl ?? undefined,
            directExit: directExit ? directExit === "true" : undefined,
        });
    }, [searchParams]);

    /**
     * The on success callback
     */
    const onSuccess = useCallback(() => {
        // If PWA can be installed, show the button to propose to install it
        if (prompt) {
            setSuccess(true);
            return;
        }

        redirectOrClose();
    }, [prompt]);

    /**
     * Redirect or close after success
     */
    const redirectOrClose = useCallback(() => {
        // Check the current atom context
        const ssoContext = jotaiStore.get(ssoContextAtom);
        // If we got a redirect, redirect to the page directly
        if (ssoContext?.redirectUrl) {
            window.location.href = decodeURIComponent(ssoContext.redirectUrl);
            return;
        }
        // If we got a direct exit, close this window
        if (ssoContext?.directExit) {
            window.close();
            return;
        }
    }, []);

    return (
        <Grid
            footer={
                <>
                    <Notice>
                        Avant de continuer, assurez vous d’utiliser un appareil
                        vous appartenant. Nexus est une solution permettant à
                        Asics de récompenser sa communauté pour participer à
                        faire connaître ses offres.{" "}
                        <strong>
                            Nexus est une solution décentralisée et open source
                            et ne stocke aucune donnée personnelle ou
                            biométrique.
                        </strong>{" "}
                        Pour en savoir plus sur Asics, vous pouvez consulter les
                        Règles de confidentialités et les Conditions
                        d’utilisation.
                    </Notice>
                    <Link href={"/recovery"} className={styles.login__link}>
                        <CloudUpload /> Recover wallet from file
                    </Link>
                </>
            }
        >
            <Header />
            <br />
            {!success && (
                <>
                    <SsoRegisterComponent onSuccess={onSuccess} />
                    <br />
                    <SsoLoginComponent onSuccess={onSuccess} />
                    <br />
                    <DebugSection />
                </>
            )}
            {success && (
                <>
                    <p>You are successfully connected to your wallet.</p>
                    <br />
                    <InstallApp />
                    <br />
                    <ButtonRipple onClick={redirectOrClose}>
                        Continue to {currentMetadata?.name}
                    </ButtonRipple>
                </>
            )}
        </Grid>
    );
}

function Header() {
    const currentMetadata = useAtomValue(currentSsoMetadataAtom);

    if (!currentMetadata) {
        return <h2>Create your Wallet</h2>;
    }

    return (
        <>
            <img
                src={currentMetadata.logoUrl}
                alt={currentMetadata.name}
                height={50}
            />
            <h2>Create your Wallet</h2>
            <p>
                to receive your rewards immediately from{" "}
                <a
                    href={currentMetadata.homepageLink}
                    target={"_blank"}
                    rel={"noreferrer"}
                >
                    {currentMetadata.name}
                </a>
            </p>
        </>
    );
}

function DebugSection() {
    const { data: debugData, error: debugError } = useQuery({
        queryKey: ["debug", "webauthn"],
        gcTime: 0,
        refetchOnMount: true,
        queryFn: async () => {
            const isWebAuthNAvailable =
                !!window.PublicKeyCredential &&
                !!PublicKeyCredential.isConditionalMediationAvailable;
            const isConditionalMediationAvailable =
                await PublicKeyCredential.isConditionalMediationAvailable();
            const isUserVerifyingPlatformAuthenticatorAvailable =
                await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

            return {
                isWebAuthNAvailable,
                isConditionalMediationAvailable,
                isUserVerifyingPlatformAuthenticatorAvailable,
            };
        },
    });

    const {
        mutate: setupConditional,
        data: authentData,
        error: authentError,
        status: authentStatus,
    } = useMutation({
        mutationKey: ["debug", "webauthn-conditional"],
        mutationFn: async () => {
            // Get regular options
            const authenticationOptions = await generateAuthenticationOptions({
                rpID: rpId,
                userVerification: "required",
                // timeout in ms (3min, can be useful for mobile phone linking)
                timeout: 180_000,
            });

            // Get the credential
            /*return await navigator.credentials.get({
                mediation: "conditional",
                publicKey: {
                    rpId: authenticationOptions.rpId,
                    challenge: base64URLStringToBuffer(authenticationOptions.challenge),
                },
            })*/

            // Start the authentication with conditional mediation
            return await startAuthentication(authenticationOptions, true);
        },
    });

    if (!debugData) {
        return (
            <>
                No debug data <br />
                {debugError && <pre>{JSON.stringify(debugError, null, 2)}</pre>}
            </>
        );
    }

    return (
        <>
            <p>
                Is webauthn available?{" "}
                {debugData.isWebAuthNAvailable.toString()}
            </p>
            <p>
                Is conditional mediation available?{" "}
                {debugData.isConditionalMediationAvailable.toString()}
            </p>
            <p>
                Is user verifying platform authenticator available?{" "}
                {debugData.isUserVerifyingPlatformAuthenticatorAvailable.toString()}
            </p>

            <hr />

            <button onClick={() => setupConditional()} type={"button"}>
                Setup conditional
            </button>

            <br />

            <input
                type={"text"}
                name={"empty autocomplete"}
                autoComplete={"username webauthn"}
                placeholder={"Click me"}
            />

            <hr />

            <p>Conditional status: {authentStatus}</p>
            {authentData && <pre>{JSON.stringify(authentData, null, 2)}</pre>}
            {authentError && <pre>{JSON.stringify(authentError, null, 2)}</pre>}
        </>
    );
}
