import css from "!!raw-loader!./index.module.css";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { Button } from "@/module/common/component/Button";
import type { ArticlePreparedForReading } from "@/type/Article";

export const cssRaw = css;

function buildRedirectUrl(redirectUrl: string) {
    const outputUrl = new URL(frakWalletSdkConfig.walletUrl);
    outputUrl.pathname = "/register";
    outputUrl.searchParams.set("redirectUrl", encodeURIComponent(redirectUrl));
    return outputUrl.toString();
}

export function Banner({ article }: { article: ArticlePreparedForReading }) {
    return (
        <div className={"banner"}>
            <div className={"banner__content"}>
                <p className={"banner__explanation"}>
                    Access for free by accepting the use of Nexus Wallet
                </p>
                <Button
                    variant={article.provider}
                    size={"small"}
                    onClick={() => {
                        window.location.href = buildRedirectUrl(
                            `${window.location.origin}/article?id=${article.id}&isFree=1`
                        );
                    }}
                >
                    Connect or create a Nexus Wallet
                </Button>
            </div>
        </div>
    );
}
