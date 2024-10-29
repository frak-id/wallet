"use client";

import { lastAuthenticatorAtom } from "@/module/authentication/atoms/lastAuthenticator";
import {
    currentSsoMetadataAtom,
    ssoContextAtom,
} from "@/module/authentication/atoms/sso";
import { SsoHeader } from "@/module/authentication/component/Sso/SsoHeader";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import {
    type CompressedSsoData,
    compressedSsoToParams,
} from "@/module/authentication/utils/ssoDataCompression";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { decompressJson } from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { formatHash } from "@module/component/HashDisplay";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { CloudUpload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./index.module.css";

/**
 * The SSO page itself
 * @constructor
 */
export function Sso() {
    const { i18n, t } = useTranslation();

    /**
     * The current metadata
     */
    const currentMetadata = useAtomValue(currentSsoMetadataAtom);

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
    useQuery({
        gcTime: 0,
        staleTime: 0,
        queryKey: ["sso", "params-decompression", searchParams.toString()],
        queryFn: async () => {
            const compressedString = searchParams.get("p");
            if (!compressedString) {
                return null;
            }
            const compressedParam =
                await decompressJson<CompressedSsoData>(compressedString);
            if (!compressedParam) {
                return null;
            }
            const { productId, redirectUrl, directExit, lang, metadata } =
                compressedSsoToParams(compressedParam);

            // Save the current sso context
            jotaiStore.set(ssoContextAtom, {
                id: compressedParam.id ?? undefined,
                productId: productId ?? undefined,
                redirectUrl: redirectUrl ?? undefined,
                directExit: directExit ?? undefined,
                metadata: metadata ?? undefined,
            });

            // If we got a language, change the i18n language
            if (lang && i18n.language !== lang) {
                await i18n.changeLanguage(lang);
            }
            // Return no data
            return null;
        },
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });

    /**
     * Add a data attribute to the root element to style the layout
     */
    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.page = "sso";
        }

        return () => {
            rootElement.removeAttribute("data-page");
        };
    }, []);

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

    if (!currentMetadata) {
        return <Spinner />;
    }

    return (
        <>
            <SsoHeader />
            <Grid
                className={styles.sso__grid}
                footer={
                    <>
                        <Notice className={styles.sso__notice}>
                            <Trans
                                i18nKey={"authent.sso.description"}
                                values={{
                                    productName: currentMetadata.name,
                                }}
                            />
                        </Notice>
                        <Link
                            href={"/recovery"}
                            className={styles.sso__recover}
                        >
                            <CloudUpload /> {t("authent.sso.recover")}
                        </Link>
                    </>
                }
            >
                <Header />
                {!success && <Actions onSuccess={onSuccess} />}
                {success && (
                    <>
                        <p className={styles.sso__redirect}>
                            <Trans
                                i18nKey={"authent.sso.redirect"}
                                values={{
                                    productName: currentMetadata.name,
                                }}
                            />
                            <span className={"dotsLoading"}>...</span>
                        </p>
                        <button
                            className={styles.sso__buttonLink}
                            onClick={redirectOrClose}
                            type={"button"}
                        >
                            {t("authent.sso.redirectNow")}
                        </button>
                    </>
                )}
            </Grid>
        </>
    );
}

function Header() {
    const { t } = useTranslation();
    const currentMetadata = useAtomValue(currentSsoMetadataAtom);
    const lastAuthenticator = useAtomValue(lastAuthenticatorAtom);
    const title = useMemo(
        () =>
            // @ts-ignore
            t("authent.sso.title", {
                context: lastAuthenticator ? "existing" : "new",
            }),
        [t, lastAuthenticator]
    );

    if (!currentMetadata) {
        return <h2>{title}</h2>;
    }

    return (
        <>
            {currentMetadata.logoUrl && (
                <img
                    src={currentMetadata.logoUrl}
                    alt={currentMetadata.name}
                    className={styles.sso__logo}
                />
            )}
            <h2 className={styles.sso__title}>{title}</h2>
            {currentMetadata.name !== "" && (
                <p className={styles.sso__ahead}>
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
                                    className={styles.sso__link}
                                >
                                    {currentMetadata.name}
                                </a>
                            ) : (
                                <u>{currentMetadata.name}</u>
                            ),
                        }}
                    />
                </p>
            )}
        </>
    );
}

function Actions({ onSuccess }: { onSuccess: () => void }) {
    const lastAuthenticator = useAtomValue(lastAuthenticatorAtom);

    // If previous wallet known
    if (lastAuthenticator) {
        return (
            <>
                <p className={styles.sso__previousWallet}>
                    <Trans
                        i18nKey={"authent.sso.previousWallet"}
                        values={{
                            wallet: formatHash({
                                hash: lastAuthenticator.address,
                            }),
                        }}
                    />
                </p>
                <SsoLoginComponent
                    onSuccess={onSuccess}
                    isPrimary={true}
                    lastAuthentication={{
                        wallet: lastAuthenticator.address,
                        authenticatorId: lastAuthenticator.authenticatorId,
                        transports: lastAuthenticator.transports,
                    }}
                />
                <SsoRegisterComponent onSuccess={onSuccess} isPrimary={false} />
            </>
        );
    }

    // If no previous wallet
    return (
        <>
            <SsoRegisterComponent onSuccess={onSuccess} isPrimary={true} />
            <SsoLoginComponent onSuccess={onSuccess} isPrimary={false} />
        </>
    );
}
