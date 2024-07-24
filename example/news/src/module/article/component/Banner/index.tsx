import css from "!!raw-loader!./index.module.css";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { Button } from "@/module/common/component/Button";
import type { Article } from "@/type/Article";
import { buildRedirectUrl } from "@frak-labs/shared/module/utils/buildRedirectUrl";

export const cssRaw = css;

export function Banner({ article }: { article: Article }) {
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
                            frakWalletSdkConfig.walletUrl,
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
