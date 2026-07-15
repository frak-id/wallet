import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    isValidShopDomain,
    redirectToShopifyAuthorize,
} from "@/module/auth/hooks/useShopifySsoRedirect";
import { Input } from "@/module/forms/Input";

/**
 * Full-page redirect into the backend-driven Shopify OAuth authorize
 * endpoint (§4.7) — not an Eden call, this is a real navigation.
 *
 * `initialShop` prefills the domain input (e.g. `/login/shopify?shop=…`
 * deep-linked from the embedded Shopify app already knows the store's
 * domain), and `redirect` is forwarded to the authorize call so the SSO
 * callback lands the user back on the page they originally wanted.
 */
export function ShopifyPanel({
    initialShop,
    redirect,
}: {
    initialShop?: string;
    redirect?: string;
}) {
    const { t } = useTranslation();
    const [shop, setShop] = useState(initialShop ?? "");
    const isValid = isValidShopDomain(shop);
    const showError = shop.length > 0 && !isValid;

    return (
        <Stack space="s">
            <Input
                variant="bare"
                tone="muted"
                autoFocus
                label={t("auth.login.shopify.label")}
                placeholder="my-store.myshopify.com"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={shop}
                onChange={(event) => setShop(event.target.value)}
                error={showError}
                hint={
                    showError
                        ? t("auth.login.shopify.invalidDomain")
                        : undefined
                }
            />
            <Button
                variant="primary"
                size="large"
                width="full"
                disabled={!isValid}
                onClick={() => redirectToShopifyAuthorize(shop, redirect)}
            >
                {t("auth.login.shopify.submit")}
            </Button>
        </Stack>
    );
}
