import { AuthenticationGated } from "@/module/embedded/component/AuthenticationGated";
import { Mint } from "@/module/embedded/component/Mint";

export default async function CampaignsContentPage() {
    return (
        <AuthenticationGated action="validate your product">
            <Mint />
        </AuthenticationGated>
    );
}
