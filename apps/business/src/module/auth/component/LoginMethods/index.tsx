import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { ContentBlock } from "@frak-labs/design-system/components/ContentBlock";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    ArrowLeftIcon,
    CartIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmailPanel } from "./EmailPanel";
import * as styles from "./login-card.css";
import { OrDivider } from "./OrDivider";
import { ShopifyPanel } from "./ShopifyPanel";
import { WalletPanel } from "./WalletPanel";

type View = "choose" | "email" | "shopify";

/**
 * Login method selector (§2 of the design doc). The Frak wallet (passkey/SIWE)
 * is the primary, always-visible method; email/password and Shopify SSO are
 * lighter secondary options. Picking one swaps the whole form to a focused
 * step (with a back control) rather than expanding an inline accordion — this
 * keeps the container a stable width and avoids nesting the email
 * login/register/forgot sub-modes inside a cramped disclosure.
 */
export function LoginMethods({ redirect }: { redirect?: string }) {
    const { t } = useTranslation();
    const [view, setView] = useState<View>("choose");

    return (
        <ContentBlock maxWidth="400px" align="left">
            <Card
                variant="elevated"
                radius="l"
                padding="none"
                className={styles.card}
            >
                {view === "choose" ? (
                    <Stack space="m">
                        <WalletPanel redirect={redirect} />
                        <OrDivider label={t("auth.login.or")} />
                        <Stack space="s">
                            <Button
                                variant="secondary"
                                size="large"
                                width="full"
                                icon={<LockIcon width={18} height={18} />}
                                onClick={() => setView("email")}
                            >
                                {t("auth.login.methods.email")}
                            </Button>
                            <Button
                                variant="secondary"
                                size="large"
                                width="full"
                                icon={<CartIcon width={18} height={18} />}
                                onClick={() => setView("shopify")}
                            >
                                {t("auth.login.methods.shopify")}
                            </Button>
                        </Stack>
                    </Stack>
                ) : (
                    <Stack space="m">
                        <Stack space="none" align="left">
                            <Button
                                variant="ghost"
                                size="small"
                                width="auto"
                                icon={<ArrowLeftIcon width={16} height={16} />}
                                onClick={() => setView("choose")}
                            >
                                {t("auth.login.back")}
                            </Button>
                        </Stack>
                        {view === "email" ? (
                            <EmailPanel redirect={redirect} />
                        ) : (
                            <ShopifyPanel />
                        )}
                    </Stack>
                )}
            </Card>
        </ContentBlock>
    );
}
