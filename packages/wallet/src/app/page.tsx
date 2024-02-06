import { AuthGate } from "@/module/authentication/component/AuthGate";
import { ClientOnly } from "@/module/common/component/ClientOnly";
import { WalletHomePage } from "@/module/wallet/component/Home";

export default async function HomePage() {
    return (
        <>
            <ClientOnly>
                <AuthGate>
                    <WalletHomePage />
                </AuthGate>
            </ClientOnly>
        </>
    );
}
