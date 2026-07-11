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
 */
export function ShopifyPanel() {
    const { t } = useTranslation();
    const [shop, setShop] = useState("");
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
                onClick={() => redirectToShopifyAuthorize(shop)}
            >
                {t("auth.login.shopify.submit")}
            </Button>
        </Stack>
    );
}
