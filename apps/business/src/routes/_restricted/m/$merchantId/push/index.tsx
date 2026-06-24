import { createFileRoute } from "@tanstack/react-router";
import { FloatingFooter } from "@/module/common/component/FloatingFooter";
import * as footerStyles from "@/module/common/component/FloatingFooter/floating-footer.css";
import { PageShell } from "@/module/common/component/PageShell";
import { ButtonSendPush } from "@/module/members/component/ButtonSendPush";
import { MembersSectionTabs } from "@/module/members/component/MembersSectionTabs";
import { PushHistory } from "@/module/members/component/PushHistory";

export const Route = createFileRoute("/_restricted/m/$merchantId/push/")({
    component: PushHistoryPage,
});

function PushHistoryPage() {
    const { merchantId } = Route.useParams();
    return (
        <div className={footerStyles.pageBottomSpacer}>
            <PageShell page="members" space="l">
                <MembersSectionTabs active="push" merchantId={merchantId} />
                <PushHistory />
            </PageShell>
            <FloatingFooter>
                <ButtonSendPush size="large" />
            </FloatingFooter>
        </div>
    );
}
