import css from "!!raw-loader!./index.module.css";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { Button } from "@/module/common/component/Button";
import type { Article } from "@/type/Article";
import { buildRedirectUrl } from "@frak-labs/shared/module/utils/buildRedirectUrl";
import { useMemo } from "react";

export const cssRaw = css;

export function ReferralPopup({
    article,
    state,
}: { article: Article; state: string }) {
    const formattedMsg = useMemo(() => {
        if (state === "no-wallet") {
            return "A Nexus user shared this link with you, create a Nexus and gain some USD";
        }
        if (state === "no-referral") {
            return "A Nexus user shared this link with you, start an interaction session and gain some USD";
        }
        return "";
    }, [state]);

    return (
        <div className={"popup"}>
            <div className={"popup__content"}>
                <p className={"popup__explanation"}>{formattedMsg}</p>
                <Button
                    variant={article.provider}
                    size={"small"}
                    onClick={() => {
                        window.location.href = buildRedirectUrl(
                            frakWalletSdkConfig.walletUrl,
                            `${window.location.origin}/article?id=${article.id}`
                        );
                    }}
                >
                    Connect or create a Nexus Wallet
                </Button>
            </div>
        </div>
    );
}
