import { Card } from "@frak-labs/design-system/components/Card";
import { ContentBlock } from "@frak-labs/design-system/components/ContentBlock";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as loginCardStyles from "@/module/auth/component/LoginMethods/login-card.css";
import { ShopifyPanel } from "@/module/auth/component/LoginMethods/ShopifyPanel";
import {
    isValidShopDomain,
    redirectToShopifyAuthorize,
} from "@/module/auth/hooks/useShopifySsoRedirect";
import { Login } from "@/module/login/component/Login";

/**
 * `/login/shopify` — SSO entrypoint deep-linked from the embedded Shopify
 * app (`shop` + `redirect` query params). Sits under the `/login` layout,
 * whose `beforeLoad: redirectIfAuthenticated` already short-circuits an
 * already-authenticated user straight to `redirect` (or `/dashboard`) — so
 * this route only ever renders for a logged-out visitor.
 *
 * With a valid `shop` and no prior `error`, it auto-fires the OAuth
 * redirect immediately (best case: the merchant already has an
 * authenticated Shopify admin session and an existing per-user grant, so
 * the whole hop is invisible). The prefilled `ShopifyPanel` renders
 * underneath as the one-click fallback for every other case: first-time
 * per-user consent screen, popup/redirect blocked, or a bounce-back from a
 * failed exchange (`error=shopify`, carried with `shop`/`redirect` by the
 * backend so the retry doesn't lose context).
 */
export const Route = createFileRoute("/login/shopify")({
    validateSearch: (
        search: Record<string, unknown>
    ): { shop?: string; redirect?: string; error?: string } => ({
        ...(typeof search.shop === "string" ? { shop: search.shop } : {}),
        ...(typeof search.redirect === "string"
            ? { redirect: search.redirect }
            : {}),
        ...(typeof search.error === "string" ? { error: search.error } : {}),
    }),
    component: LoginShopifySso,
});

function LoginShopifySso() {
    const { t } = useTranslation();
    const { shop, redirect, error } = Route.useSearch();
    const started = useRef(false);
    const [autoRedirecting, setAutoRedirecting] = useState(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        // Only attempt the invisible hop on a fresh visit with a valid shop.
        // A prior failed exchange (`error` set) or a missing/invalid shop
        // falls straight through to the prefilled manual panel below.
        if (!error && shop && isValidShopDomain(shop)) {
            setAutoRedirecting(true);
            redirectToShopifyAuthorize(shop, redirect);
        }
    }, [shop, redirect, error]);

    return (
        <Login error={error}>
            {/* Same branded card shell as `LoginMethods`/`PendingTwoFactor` so
                this entrypoint looks identical to the rest of the login tree
                rather than a bespoke interstitial. */}
            <ContentBlock maxWidth="400px" align="left">
                <Card
                    variant="elevated"
                    radius="l"
                    padding="none"
                    className={loginCardStyles.card}
                >
                    {autoRedirecting ? (
                        <Stack space="m" align="center">
                            <Spinner />
                            <Text variant="body" color="secondary">
                                {t("auth.login.shopify.redirecting")}
                            </Text>
                        </Stack>
                    ) : (
                        <ShopifyPanel initialShop={shop} redirect={redirect} />
                    )}
                </Card>
            </ContentBlock>
        </Login>
    );
}
