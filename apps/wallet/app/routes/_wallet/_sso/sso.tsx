import {
    type CompressedSsoData,
    compressJsonToB64,
    decompressJsonFromB64,
    findIframeInOpener,
    type SsoMetadata,
} from "@frak-labs/core-sdk";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleCheckIcon, LogoFrak } from "@frak-labs/design-system/icons";
import { createRpcClient } from "@frak-labs/frame-connector";
import type { Session, SsoRpcSchema } from "@frak-labs/wallet-shared";
import {
    authenticationStore,
    clientIdStore,
    compressedSsoToParams,
    HandleErrors,
    PairingView,
    sessionStore,
    ssoKey,
    ua,
} from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import i18next from "i18next";
import { useCallback, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import * as styles from "@/module/authentication/component/Sso/index.css";
import { SsoHeader } from "@/module/authentication/component/Sso/SsoHeader";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import { useDemoLogin } from "@/module/authentication/hook/useDemoLogin";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import { PageLayout } from "@/module/common/component/PageLayout";
import { StepLayout } from "@/module/common/component/StepLayout";

/**
 * Metadata actually stored on the SSO context — base SsoMetadata plus the
 * optional `name` field injected by the wallet-shared store layer.
 */
type Metadata = SsoMetadata & { name?: string };

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
        const { merchantId, redirectUrl, directExit, lang, metadata } =
            compressedSsoToParams(compressedParam);

        // Save the SSO context to the store
        authenticationStore.getState().setSsoContext({
            merchantId: merchantId || undefined,
            redirectUrl: redirectUrl ?? undefined,
            directExit: directExit ?? undefined,
            metadata: metadata ?? undefined,
        });

        // Save the client id if provided
        if (compressedParam.cId) {
            clientIdStore.getState().setClientId(compressedParam.cId);
        }

        // Change language if provided and different from current
        if (lang && i18next.language !== lang) {
            await i18next.changeLanguage(lang);
        }

        return {
            ssoParams: { merchantId, redirectUrl, directExit, lang, metadata },
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
    const ssoContext = authenticationStore((state) => state.ssoContext);
    const currentMetadata = useMemo(
        () => ssoContext?.metadata,
        [ssoContext?.metadata]
    );

    /**
     * Whether we know of a previously-used passkey on this device.
     */
    const lastAuthenticator = authenticationStore(
        (state) => state.lastAuthenticator
    );

    /**
     * The success state after login or register
     */
    const [success, setSuccess] = useState(false);

    /**
     * The loader error (from beforeLoad, unrecoverable)
     */
    const loaderError = (routeContext as { error?: Error })?.error ?? null;

    /**
     * The action error state (from login/register, retryable)
     */
    const [error, setError] = useState<Error | null>(null);

    /**
     * Current view: initial auth choices or QR-code pairing screen.
     */
    const [view, setView] = useState<"choose" | "pairing">("choose");

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
     * Title shown in the hero — differs depending on whether the user has a
     * previously-registered passkey on this device.
     */
    const title = useMemo(
        () =>
            lastAuthenticator
                ? t("authent.sso.title_existing")
                : t("authent.sso.title_new"),
        [t, lastAuthenticator]
    );

    // Show error state if loader failed
    if (loaderError) {
        return (
            <>
                <SsoHeader />
                <StepLayout
                    icon={<span>⚠️</span>}
                    title="An error occurred"
                    description={
                        <HandleErrors
                            error={loaderError}
                            className={styles.errorText}
                        />
                    }
                    footer={
                        <Button variant="ghost" onClick={() => window.close()}>
                            Close
                        </Button>
                    }
                />
            </>
        );
    }

    if (!currentMetadata) {
        return (
            <>
                <SsoHeader />
                <Spinner />
            </>
        );
    }

    // Success state — waiting for redirect/close
    if (success) {
        return (
            <>
                <SsoHeader />
                <StepLayout
                    icon={
                        <Box className={styles.successIcon}>
                            <CircleCheckIcon width={72} height={72} />
                        </Box>
                    }
                    title={title}
                    description={
                        <>
                            <Trans
                                i18nKey={"authent.sso.redirect"}
                                values={{
                                    productName: currentMetadata.name,
                                }}
                            />
                            <span className="dotsLoading">...</span>
                        </>
                    }
                    footer={
                        <Button variant="ghost" onClick={redirectOrClose}>
                            {t("authent.sso.redirectNow")}
                        </Button>
                    }
                />
            </>
        );
    }

    if (view === "pairing") {
        return (
            <PageLayout>
                <Box className={styles.ssoContentTop}>
                    <PairingView
                        title={t("authent.sso.pairing.title")}
                        description={t("authent.sso.pairing.description")}
                        onSuccess={onSuccess}
                    />
                </Box>
            </PageLayout>
        );
    }

    return (
        <PageLayout
            footer={
                <>
                    {error && (
                        <HandleErrors
                            error={error}
                            className={styles.errorText}
                        />
                    )}
                    <Box className={styles.ssoActions}>
                        <Actions onSuccess={onSuccess} onError={setError} />
                        <PhonePairingAction
                            onClick={() => setView("pairing")}
                        />
                    </Box>
                    <Disclaimer metadata={currentMetadata} />
                </>
            }
        >
            <SsoHeader />
            <Box className={styles.ssoContent}>
                <ContentBlock
                    icon={<MerchantIcon metadata={currentMetadata} />}
                    titleAs="h1"
                    title={title}
                    description={<SsoSubtitle metadata={currentMetadata} />}
                    contentSpacing="l"
                    textSpacing="m"
                />
            </Box>
        </PageLayout>
    );
}

/**
 * Circular merchant logo used as the hero icon.
 * Falls back to the flat-blue Frak mark when no merchant logo is provided.
 */
function MerchantIcon({ metadata }: { metadata: Metadata }) {
    if (metadata.logoUrl) {
        return (
            <Box className={styles.merchantIcon}>
                <img
                    src={metadata.logoUrl}
                    alt={metadata.name ?? ""}
                    className={styles.merchantImg}
                />
            </Box>
        );
    }
    return (
        <Box className={styles.merchantIcon}>
            <LogoFrak width={48} height={48} />
        </Box>
    );
}

/**
 * Hero subtitle — "to immediately receive your winnings from {merchant}".
 * Returns null when the metadata has no merchant name.
 */
function SsoSubtitle({ metadata }: { metadata: Metadata }) {
    if (!metadata.name) return null;
    return (
        <Trans
            i18nKey={"authent.sso.subTitle"}
            values={{
                productName: metadata.name,
                productLink: metadata.homepageLink,
            }}
            components={{
                pLink: metadata.homepageLink ? (
                    <a
                        href={metadata.homepageLink}
                        target={"_blank"}
                        rel={"noreferrer"}
                        className={styles.merchantLink}
                    >
                        {metadata.name}
                    </a>
                ) : (
                    <u>{metadata.name}</u>
                ),
            }}
        />
    );
}

/**
 * Simplified disclaimer matching the Figma design.
 */
function Disclaimer({ metadata }: { metadata: Metadata }) {
    return (
        <Text variant="caption" align="center" color="primary">
            <Trans
                i18nKey={"authent.sso.description"}
                values={{
                    productName: metadata.name,
                }}
                components={{
                    conditionsLink: (
                        // biome-ignore lint/a11y/useAnchorContent: Trans injects children from i18n
                        <a
                            href="https://frak.id/terms"
                            target="_blank"
                            rel="noreferrer"
                            className={styles.disclaimerLink}
                        />
                    ),
                    privacyLink: (
                        // biome-ignore lint/a11y/useAnchorContent: Trans injects children from i18n
                        <a
                            href="https://frak.id/privacy"
                            target="_blank"
                            rel="noreferrer"
                            className={styles.disclaimerLink}
                        />
                    ),
                }}
            />
        </Text>
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
    const merchantId = authenticationStore(
        (state) => state.ssoContext?.merchantId
    );
    const privateKey = sessionStore((state) => state.demoPrivateKey);
    const { login, isLoginInProgress } = useLoginDemo({
        onSuccess: () => onSuccess(),
        onError: (error: Error | null) => onError(error),
    });
    const { t } = useTranslation();

    if (privateKey) {
        return (
            <Box>
                <ButtonAuth
                    onClick={() => {
                        login();
                    }}
                    disabled={isLoginInProgress}
                >
                    {t("authent.sso.btn.existing.login")}
                </ButtonAuth>
            </Box>
        );
    }

    // If previous wallet known
    if (lastAuthenticator) {
        return (
            <>
                <SsoLoginComponent
                    onSuccess={onSuccess}
                    onError={onError}
                    isPrimary={true}
                    merchantId={merchantId}
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
                    merchantId={merchantId}
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
                merchantId={merchantId}
            />
            <SsoLoginComponent
                onSuccess={onSuccess}
                onError={onError}
                isPrimary={false}
                merchantId={merchantId}
            />
        </>
    );
}

function PhonePairingAction({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();

    // Don't show the phone pairing action on mobile devices
    if (ua.isMobile) {
        return null;
    }

    return (
        <Box>
            <Button variant="ghost" onClick={onClick}>
                {t("authent.sso.btn.new.phone")}
            </Button>
        </Box>
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
            const pkey = sessionStore.getState().demoPrivateKey;
            if (!pkey) {
                throw new Error("No private key found");
            }

            // Launch the login process
            return demoLogin({
                pkey,
                merchantId:
                    authenticationStore.getState().ssoContext?.merchantId,
            });
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
