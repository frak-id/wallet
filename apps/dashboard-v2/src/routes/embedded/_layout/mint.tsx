import { createFileRoute } from "@tanstack/react-router";
import { AuthenticationGated } from "@/module/embedded/component/AuthenticationGated";
import { EmbeddedMint } from "@/module/embedded/component/Mint";

export const Route = createFileRoute("/embedded/_layout/mint")({
    component: EmbeddedMintPage,
    validateSearch: (search: Record<string, unknown>) => {
        // Required parameters
        const d = search.d as string | undefined;
        const sc = search.sc as string | undefined;
        const pt = search.pt as string | undefined;

        // Optional parameters
        const n = search.n as string | undefined;
        const c = search.c as string | undefined;

        return {
            n,
            d: d ?? "",
            sc: sc ?? "",
            pt: pt ?? "",
            c,
        };
    },
});

function EmbeddedMintPage() {
    return (
        <AuthenticationGated action="validate your product">
            <EmbeddedMint />
        </AuthenticationGated>
    );
}
