import { AuthenticationGated } from "@/module/embedded/component/AuthenticationGated";
import { EmbeddedPurchaseTracker } from "@/module/embedded/component/PurchaseTracker";

export default async function EmbeddedPurchaseTrackerPage() {
    return (
        <AuthenticationGated action="create your purchase tracker">
            <EmbeddedPurchaseTracker />
        </AuthenticationGated>
    );
}
