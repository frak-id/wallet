import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { useTranslation } from "react-i18next";
import { EmailPanel } from "./EmailPanel";
import { ShopifyPanel } from "./ShopifyPanel";
import { WalletPanel } from "./WalletPanel";

/**
 * Login method selector (§2 of the design doc): wallet (unchanged SIWE),
 * email/password, and Shopify SSO.
 */
export function LoginMethods({ redirect }: { redirect?: string }) {
    const { t } = useTranslation();

    return (
        <Tabs defaultValue="wallet">
            <TabsList>
                <TabsTrigger value="wallet">
                    {t("auth.login.methods.wallet")}
                </TabsTrigger>
                <TabsTrigger value="email">
                    {t("auth.login.methods.email")}
                </TabsTrigger>
                <TabsTrigger value="shopify">
                    {t("auth.login.methods.shopify")}
                </TabsTrigger>
            </TabsList>
            <TabsContent value="wallet">
                <WalletPanel redirect={redirect} />
            </TabsContent>
            <TabsContent value="email">
                <EmailPanel redirect={redirect} />
            </TabsContent>
            <TabsContent value="shopify">
                <ShopifyPanel />
            </TabsContent>
        </Tabs>
    );
}
