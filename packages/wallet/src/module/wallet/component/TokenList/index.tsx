import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { Skeleton } from "@/module/common/component/Skeleton";
import { useGetUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { TokenItem } from "@/module/wallet/component/TokenItem";
import styles from "./index.module.css";

export function TokenList({
    setSelectedValue,
}: {
    setSelectedValue?: (value: GetUserErc20Token) => void;
}) {
    const { tokens, isLoading } = useGetUserTokens();

    if (isLoading) {
        return <Skeleton height={100} />;
    }

    return (
        tokens && (
            <ul className={styles.tokenList}>
                {tokens.map((token) => (
                    <TokenItem
                        token={token}
                        key={token.contractAddress}
                        setSelectedValue={setSelectedValue}
                    />
                ))}
            </ul>
        )
    );
}
