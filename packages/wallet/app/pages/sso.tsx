import { Sso } from "@/module/authentication/component/Sso";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";

export default function SSORoute() {
    return (
        <GlobalLayout header={false}>
            <Sso />
        </GlobalLayout>
    );
}
