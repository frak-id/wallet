import { AuthenticationGated } from "@/module/embedded/component/AuthenticationGated";
import { EmbeddedMint } from "@/module/embedded/component/Mint";

export default async function EmbeddedMintPage() {
    return (
        <AuthenticationGated action="validate your product">
            <EmbeddedMint />
        </AuthenticationGated>
    );
}
