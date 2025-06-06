import { lastAuthenticatorAtom } from "@/module/authentication/atoms/lastAuthenticator";
import {
    currentSsoMetadataAtom,
    ssoContextAtom,
} from "@/module/authentication/atoms/sso";
import { SsoHeader } from "@/module/authentication/component/Sso/SsoHeader";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import styles from "@/module/authentication/component/Sso/index.module.css";
import { ssoKey } from "@/module/authentication/queryKeys/sso";
import {
    type CompressedSsoData,
    compressedSsoToParams,
} from "@/module/authentication/utils/ssoDataCompression";
import { demoPrivateKeyAtom } from "@/module/common/atoms/session";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import type { Session } from "@/types/Session";
import { decompressJsonFromB64 } from "@frak-labs/core-sdk";
import { Fingerprint } from "@shared/module/asset/icons/Fingerprint";
import { jotaiStore } from "@shared/module/atoms/store";
import { AuthFingerprint } from "@shared/module/component/AuthFingerprint";
import { formatHash } from "@shared/module/component/HashDisplay";
import { Spinner } from "@shared/module/component/Spinner";
import {
    type UseMutationOptions,
    useMutation,
    useQuery,
} from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { CloudUpload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { Hex } from "viem";
import { useDemoLogin } from "../../module/authentication/hook/useDemoLogin";
import "./sso.global.css";
import { HandleErrors } from "@/module/listener/component/HandleErrors";
import { AuthenticateWithPhone } from "@/module/listener/modal/component/AuthenticateWithPhone";
import { trackAuthInitiated } from "../../module/common/analytics";

export default function Sso() {
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
     * The error state
     */
    const [error, setError] = useState<Error | null>(null);

    /**
     * Get the search params and set stuff in the sso context
     */
    const [searchParams] = useSearchParams();

    /**
     * Set the sso context atom directly
     */
    useQuery({
        gcTime: 0,
        staleTime: 0,
        queryKey: ssoKey.params.bySearchParams(searchParams.toString()),
        queryFn: async () => {
            const compressedString = searchParams.get("p");
            if (!compressedString) {
                return null;
            }
            const compressedParam =
                decompressJsonFromB64<CompressedSsoData>(compressedString);
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
                            to={"/recovery"}
                            className={styles.sso__recover}
                            viewTransition
                        >
                            <CloudUpload /> {t("authent.sso.recover")}
                        </Link>
                    </>
                }
            >
                <Header />
                {!success && (
                    <>
                        <Actions onSuccess={onSuccess} onError={setError} />
                        <PhonePairingAction />
                    </>
                )}

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
                {error && <HandleErrors error={error} />}
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

function Actions({
    onSuccess,
    onError,
}: {
    onSuccess: () => void;
    onError: (error: Error | null) => void;
}) {
    const lastAuthenticator = useAtomValue(lastAuthenticatorAtom);
    const privateKey = useAtomValue(demoPrivateKeyAtom);
    const { login, isLoginInProgress } = useLoginDemo({
        onSuccess: () => onSuccess(),
        onError: (error: Error | null) => onError(error),
    });
    const { t } = useTranslation();

    if (privateKey) {
        return (
            <p className={styles.sso__primaryButtonWrapper}>
                <AuthFingerprint
                    icon={<Fingerprint color={"#fff"} sizes={39} />}
                    isShiny={false}
                    action={() => {
                        login();
                    }}
                    disabled={isLoginInProgress}
                    className={styles.sso__buttonPrimary}
                    childrenPosition={"top"}
                >
                    {t("authent.sso.btn.existing.login")}
                </AuthFingerprint>
            </p>
        );
    }

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
                    onError={onError}
                    isPrimary={true}
                    lastAuthentication={{
                        wallet: lastAuthenticator.address,
                        authenticatorId: lastAuthenticator.authenticatorId,
                        transports: lastAuthenticator.transports,
                    }}
                />
                <SsoRegisterComponent
                    onSuccess={onSuccess}
                    onError={onError}
                    isPrimary={false}
                />
            </>
        );
    }

    // If no previous wallet
    return (
        <>
            <SsoRegisterComponent
                onSuccess={onSuccess}
                onError={onError}
                isPrimary={true}
            />
            <SsoLoginComponent
                onSuccess={onSuccess}
                onError={onError}
                isPrimary={false}
            />
        </>
    );
}

function PhonePairingAction() {
    const { t } = useTranslation();
    const ssoId = useAtomValue(ssoContextAtom)?.id;

    if (!ssoId) {
        return null;
    }

    return (
        <div className={styles.sso__secondaryButtonWrapper}>
            <AuthenticateWithPhone
                text={t("authent.sso.btn.new.phone")}
                className={styles.sso__buttonLink}
                ssoId={ssoId}
            />
        </div>
    );
}

function useLoginDemo(options?: UseMutationOptions<Session>) {
    const { mutateAsync: demoLogin } = useDemoLogin();
    /**
     * Mutation used to launch the login demo process
     */
    const {
        isPending: isLoginInProgress,
        isSuccess,
        isError,
        error,
        mutateAsync,
    } = useMutation({
        ...options,
        mutationKey: ssoKey.demo.login,
        async mutationFn() {
            // Identify the user and track the event
            await trackAuthInitiated("demo");

            // Retrieve the pkey
            const pkey = jotaiStore.get(demoPrivateKeyAtom) as Hex | undefined;
            if (!pkey) {
                throw new Error("No private key found");
            }

            // Get the SSO ID
            const ssoId = jotaiStore.get(ssoContextAtom)?.id;

            // Launch the login process
            return demoLogin({ pkey, ssoId: ssoId });
        },
    });

    return {
        isLoginInProgress,
        isSuccess,
        isError,
        error,
        login: mutateAsync,
    };
}
