import { RestrictedLayout } from "@/module/layout/RestrictedLayout";
import { TokensSend } from "@/module/tokens/component/TokensSend";

export default function TokensSendRoute() {
    return (
        <RestrictedLayout>
            <TokensSend />
        </RestrictedLayout>
    );
}
