import * as footerStyles from "@/module/common/component/FloatingFooter/floating-footer.css";
import { PageShell } from "@/module/common/component/PageShell";
import { AddMerchantFooter } from "@/module/dashboard/component/AddMerchantSheet/AddMerchantFooter";
import { MyMerchants } from "@/module/dashboard/component/Products";

export function MerchantsPage() {
    return (
        <div className={footerStyles.pageBottomSpacer}>
            <PageShell page="dashboard">
                <MyMerchants />
            </PageShell>
            <AddMerchantFooter />
        </div>
    );
}
