import css from "!!raw-loader!./index.module.css";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { Button } from "@/module/common/component/Button";
import type { Article } from "@/type/Article";

export const cssRaw = css;

function buildRedirectUrl(redirectUrl: string) {
    const outputUrl = new URL(frakWalletSdkConfig.walletUrl);
    outputUrl.pathname = "/register";
    outputUrl.searchParams.set("redirectUrl", encodeURIComponent(redirectUrl));
    return outputUrl.toString();
}

export function Popup({ article }: { article: Article }) {
    return (
        <div className={"popup"}>
            <div className={"popup__content"}>
                <p className={"popup__explanation"}>
                    A Nexus user shared this link with you, create a Nexus
                    account to instantly get 50rFRK
                </p>
                <Button
                    variant={article.provider}
                    size={"small"}
                    onClick={() => {
                        window.location.href = buildRedirectUrl(
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
