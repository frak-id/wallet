import {
    type CompressedSsoData,
    compressJsonToB64,
    decompressJsonFromB64,
    findIframeInOpener,
} from "@frak-labs/core-sdk";
import {
    createClientCompressionMiddleware,
    createRpcClient,
} from "@frak-labs/frame-connector";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { formatHash } from "@frak-labs/ui/component/HashDisplay";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import type {
    OnPairingSuccessCallback,
    Session,
    SsoRpcSchema,
} from "@frak-labs/wallet-shared";
import {
    authenticationStore,
    compressedSsoToParams,
    HandleErrors,
    sessionStore,
    ssoKey,
    ua,
} from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import i18next from "i18next";
import { CloudUpload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import styles from "@/module/authentication/component/Sso/index.module.css";
import { SsoHeader } from "@/module/authentication/component/Sso/SsoHeader";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import { useDemoLogin } from "@/module/authentication/hook/useDemoLogin";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import "./sso.global.css";

export const Route = createFileRoute("/_wallet/_sso/sso")({
    component: Sso,
    validateSearch: (search: Record<string, unknown>) => {
        return {
            p: (search.p as string) || undefined,
        };
    },
    beforeLoad: async ({ search }) => {
        const compressedString = search.p;
        if (!compressedString) {
            // If no SSO params, redirect to register
            throw redirect({ to: "/register", replace: true });
        }

        // Decompress the SSO parameters
        const compressedParam =
            decompressJsonFromB64<CompressedSsoData>(compressedString);
        if (!compressedParam) {
            // Return error to be handled gracefully by component
            return {
                error: new Error(
                    "Invalid SSO parameters. The link may be corrupted or expired."
                ),
            };
        }

        // Convert compressed params to full params
        const { productId, redirectUrl, directExit, lang, metadata } =
            compressedSsoToParams(compressedParam);

        // Save the SSO context to the store
        authenticationStore.getState().setSsoContext({
            productId: productId ?? undefined,
            redirectUrl: redirectUrl ?? undefined,
            directExit: directExit ?? undefined,
            metadata: metadata ?? undefined,
        });

        // Change language if provided and different from current
        if (lang && i18next.language !== lang) {
            await i18next.changeLanguage(lang);
        }

        return {
            ssoParams: { productId, redirectUrl, directExit, lang, metadata },
        };
    },
});

function Sso() {
    const { t } = useTranslation();

    /**
     * Get route context to check for initialization errors
     * beforeLoad returns route context, not loader data
     */
    const routeContext = Route.useRouteContext();

    /**
     * The current metadata
     */
    const currentMetadata = authenticationStore(
        (state) => state.ssoContext?.metadata
    );

    /**
     * Check if we have a redirectUrl
     */
    const ssoContext = authenticationStore((state) => state.ssoContext);
    const hasRedirectUrl = !!ssoContext?.redirectUrl;

    /**
     * The success state after login or register
     */
    const [success, setSuccess] = useState(false);

    /**
     * The error state (can come from beforeLoad or from login/register actions)
     */
    const [error, setError] = useState<Error | null>(
        (routeContext as { error?: Error })?.error ?? null
    );

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
     * After successful auth, send RPC message to wallet listener iframe
     */
    const onSuccess = useCallback(async () => {
        // Get the current SSO context
        const session = sessionStore.getState().session;
        const sdkSession = sessionStore.getState().sdkSession;

        // Find the listener iframe and send RPC message if available
        if (session && sdkSession) {
            const listenerIframe = findIframeInOpener();

            if (listenerIframe) {
                try {
                    // Create RPC client targeting the listener iframe
                    const ssoClient = createRpcClient<SsoRpcSchema>({
                        emittingTransport: listenerIframe,
                        listeningTransport: window,
                        targetOrigin: window.location.origin,
                        middleware: [createClientCompressionMiddleware()],
                    });

                    console.log(
                        "[SSO] Sent completion message to listener iframe via RPC",
                        {
                            address: session.address,
                        }
                    );

                    // Send SSO completion via RPC
                    await ssoClient.request({
                        method: "sso_complete",
                        params: [session, sdkSession],
                    });

                    // Cleanup the client
                    ssoClient.cleanup();
                } catch (error) {
                    console.error(
                        "[SSO] Failed to send completion message via RPC:",
                        error
                    );
                }
            }
        }

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
        // Check the current store context
        const ssoContext = authenticationStore.getState().ssoContext;
        // If we got a redirect, redirect to the page directly with success status
        if (ssoContext?.redirectUrl) {
            const redirectUrl = new URL(
                decodeURIComponent(ssoContext.redirectUrl)
            );

            // Get the full SSO params and compress them for URL passthrough
            const session = sessionStore.getState().session;
            const sdkSession = sessionStore.getState().sdkSession;
            if (session && sdkSession) {
                // Compress to base64url for URL parameter
                const compressed = compressJsonToB64([session, sdkSession]);
                redirectUrl.searchParams.set("sso", compressed);
            }

            window.location.href = redirectUrl.toString();
            return;
        }
        // If we got a direct exit, close this window
        if (ssoContext?.directExit) {
            window.close();
            return;
        }
    }, []);

    /**
     * Cancel SSO and redirect back
     */
    const cancelAndRedirect = useCallback(() => {
        const initialRedirectUrl =
            authenticationStore.getState().ssoContext?.redirectUrl;
        if (initialRedirectUrl) {
            const redirectUrl = new URL(decodeURIComponent(initialRedirectUrl));
            redirectUrl.searchParams.set("status", "cancel");
            window.location.href = redirectUrl.toString();
        }
    }, []);

    // Show error state if loader failed
    if (error) {
        return (
            <>
                <SsoHeader />
                <Grid className={styles.sso__grid}>
                    <h2>An error occurred</h2>
                    <HandleErrors error={error} />
                    <button
                        className={styles.sso__buttonLink}
                        onClick={() => window.close()}
                        type={"button"}
                    >
                        Close
                    </button>
                </Grid>
            </>
        );
    }

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
                        {hasRedirectUrl ? (
                            <button
                                onClick={cancelAndRedirect}
                                className={styles.sso__recover}
                                type={"button"}
                            >
                                {t("authent.sso.cancel")}
                            </button>
                        ) : (
                            <Link
                                to={"/recovery"}
                                className={styles.sso__recover}
                                viewTransition
                            >
                                <CloudUpload /> {t("authent.sso.recover")}
                            </Link>
                        )}
                    </>
                }
            >
                <Header />
                {!success && (
                    <>
                        <Actions onSuccess={onSuccess} onError={setError} />
                        <PhonePairingAction onSuccess={onSuccess} />
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
    const currentMetadata = authenticationStore(
        (state) => state.ssoContext?.metadata
    );
    const lastAuthenticator = authenticationStore(
        (state) => state.lastAuthenticator
    );
    const title = useMemo(
        () =>
            lastAuthenticator
                ? t("authent.sso.title_existing")
                : t("authent.sso.title_new"),
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
    const lastAuthenticator = authenticationStore(
        (state) => state.lastAuthenticator
    );
    const privateKey = sessionStore((state) => state.demoPrivateKey);
    const { login, isLoginInProgress } = useLoginDemo({
        onSuccess: () => onSuccess(),
        onError: (error: Error | null) => onError(error),
    });
    const { t } = useTranslation();

    if (privateKey) {
        return (
            <p className={styles.sso__primaryButtonWrapper}>
                <ButtonAuth
                    onClick={() => {
                        login();
                    }}
                    disabled={isLoginInProgress}
                >
                    {t("authent.sso.btn.existing.login")}
                </ButtonAuth>
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

function PhonePairingAction({
    onSuccess,
}: {
    onSuccess: OnPairingSuccessCallback;
}) {
    const { t } = useTranslation();

    // Don't show the phone pairing action if we don't have an sso id or if we are on a mobile device
    if (ua.isMobile) {
        return null;
    }

    return (
        <div className={styles.sso__secondaryButtonWrapper}>
            <AuthenticateWithPhone
                text={t("authent.sso.btn.new.phone")}
                className={styles.sso__buttonLink}
                onSuccess={onSuccess}
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
            // Retrieve the pkey
            const pkey = sessionStore.getState().demoPrivateKey as
                | Hex
                | undefined;
            if (!pkey) {
                throw new Error("No private key found");
            }

            // Launch the login process
            return demoLogin({ pkey });
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
