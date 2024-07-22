"use client";

import { ssoContextAtom } from "@/module/authentication/atoms/sso";
import styles from "@/module/authentication/component/Login/index.module.css";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { jotaiStore } from "@module/atoms/store";
import { CloudUpload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

/**
 * The SSO page itself
 * @constructor
 */
export function Sso() {
    /**
     * Get the search params and set stuff in the sso context
     */
    const searchParams = useSearchParams();

    /**
     * Set the sso context atom directly
     */
    useEffect(() => {
        const redirectUrl = searchParams.get("redirectUrl");
        const directExit = searchParams.get("directExit");

        jotaiStore.set(ssoContextAtom, {
            redirectUrl: redirectUrl ?? undefined,
            directExit: directExit ? directExit === "true" : undefined,
        });
    }, [searchParams]);

    /**
     * The on success callback
     */
    const onSuccess = useCallback(() => {
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
                    <Link href={"/recovery"} className={styles.login__link}>
                        <CloudUpload /> Recover wallet from file
                    </Link>
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
                </>
            }
        >
            <h3>Créer un portefeuille</h3>
            <SsoRegisterComponent onSuccess={onSuccess} />
            <br />
            <SsoLoginComponent onSuccess={onSuccess} />
        </Grid>
    );
}
