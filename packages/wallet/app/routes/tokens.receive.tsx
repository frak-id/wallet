import { RestrictedLayout } from "@/module/layout/RestrictedLayout";
import { TokensReceive } from "@/module/tokens/component/TokensReceive";

export default function TokensReceiveRoute() {
    return (
        <RestrictedLayout>
            <TokensReceive />
        </RestrictedLayout>
    );
}
