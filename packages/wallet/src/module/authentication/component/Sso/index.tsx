"use client";

import {
    currentSsoMetadataAtom,
    ssoContextAtom,
    ssoMetadataAtom,
} from "@/module/authentication/atoms/sso";
import styles from "@/module/authentication/component/Login/index.module.css";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { jotaiStore } from "@module/atoms/store";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useAtomValue, useSetAtom } from "jotai";
import { CloudUpload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

/**
 * The SSO page itself
 * @constructor
 */
export function Sso() {
    const { i18n } = useTranslation();
    /**
     * The current metadata
     */
    const currentMetadata = useAtomValue(currentSsoMetadataAtom);

    /**
     * Set the sso metadata atom
     */
    const setSsoMetadata = useSetAtom(ssoMetadataAtom);

    /**
     * The success state after login or register
     */
    const [success, setSuccess] = useState(false);

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
        const lang = searchParams.get("lng");

        // If we got a language, change the i18n language
        if (lang) {
            i18n.changeLanguage(lang);
        }

        jotaiStore.set(ssoContextAtom, {
            productId: productId ?? undefined,
            redirectUrl: redirectUrl ?? undefined,
            directExit: directExit ? directExit === "true" : undefined,
        });

        if (!productId) return;

        // Set the metadata
        setSsoMetadata((prev) => ({
            ...prev,
            [productId]: {
                name: searchParams.get("name") ?? "",
                logoUrl: searchParams.get("logoUrl") ?? undefined,
                homepageLink: searchParams.get("homepageLink") ?? undefined,
            },
        }));
    }, [searchParams, setSsoMetadata, i18n]);

    /**
     * The on success callback
     */
    const onSuccess = useCallback(() => {
        // Redirect the user in 2seconds
        setSuccess(true);
        setTimeout(() => {
            redirectOrClose();
        }, 2000);
    }, []);

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
                        <Trans
                            i18nKey={"authent.sso.description"}
                            values={{
                                productName:
                                    currentMetadata?.name ?? "companies",
                            }}
                        />
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
                    <p>
                        You will be redirected to {currentMetadata?.name} in a
                        few seconds.<span className={"dotsLoading"}>...</span>
                    </p>
                    <br />
                    <ButtonRipple onClick={redirectOrClose}>
                        Redirect now
                    </ButtonRipple>
                </>
            )}
        </Grid>
    );
}

function Header() {
    const { t } = useTranslation();
    const currentMetadata = useAtomValue(currentSsoMetadataAtom);

    if (!currentMetadata) {
        return <h2>{t("authent.sso.title")}</h2>;
    }

    return (
        <>
            {currentMetadata.logoUrl && (
                <img
                    src={currentMetadata.logoUrl}
                    alt={currentMetadata.name}
                    className={styles.login__icon}
                />
            )}
            <h2>{t("authent.sso.title")}</h2>
            {currentMetadata.name !== "" && (
                <Trans
                    i18nKey={"authent.sso.subTitle"}
                    values={{
                        productName: currentMetadata.name,
                        productLink: currentMetadata.homepageLink,
                    }}
                    components={{
                        pLink: currentMetadata.homepageLink ? (
                            <a
                                href={currentMetadata.homepageLink}
                                target={"_blank"}
                                rel={"noreferrer"}
                            >
                                {currentMetadata.name}
                            </a>
                        ) : (
                            <u>{currentMetadata.name}</u>
                        ),
                    }}
                />
            )}
        </>
    );
}
