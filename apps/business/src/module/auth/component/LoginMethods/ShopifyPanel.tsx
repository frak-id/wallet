import { Button } from "@frak-labs/design-system/components/Button";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
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

    return (
        <Stack space="s">
            <Input
                placeholder="my-store.myshopify.com"
                value={shop}
                onChange={(event) => setShop(event.target.value)}
            />
            {shop.length > 0 && !isValid && (
                <FieldError>{t("auth.login.shopify.invalidDomain")}</FieldError>
            )}
            <Button
                variant="primary"
                size="large"
                width="auto"
                disabled={!isValid}
                onClick={() => redirectToShopifyAuthorize(shop)}
            >
                {t("auth.login.shopify.submit")}
            </Button>
        </Stack>
    );
}
