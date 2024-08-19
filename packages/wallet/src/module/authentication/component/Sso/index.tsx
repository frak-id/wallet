"use client";

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

    /**
     * Redirect to the wallet's homepage if the app is installed
     */
    useMemo(() => {
        if (isInstalled) {
            redirectOrClose();
        }
    }, [isInstalled, redirectOrClose]);

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
