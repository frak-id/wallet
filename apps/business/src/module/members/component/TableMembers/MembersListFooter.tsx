import { FloatingFooter } from "@/module/common/component/FloatingFooter";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";

/**
 * Floating bottom bar with the "Send Push Notification" CTA. Pinned to the
 * viewport so it stays visible while the member list scrolls underneath.
 */
export function MembersListFooter() {
    return (
        <FloatingFooter>
            <ButtonSendPush size="large" />
        </FloatingFooter>
    );
}
