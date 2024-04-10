import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { useCommunityTokenForContent } from "@/module/community-token/hooks/useCommunityTokenForContent";
import { useMintCommunityToken } from "@/module/community-token/hooks/useMintCommunityToken";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function ButtonMintCommunity({
    name,
    contentId,
}: { name: string; contentId: number }) {
    const [tokenAddress, setTokenAddress] = useState<Hex | undefined>(
        undefined
    );
    const { data: tokenAddressFetched } = useCommunityTokenForContent({
        contentId,
    });
    const { mutateAsync, isPending } = useMintCommunityToken({ tokenAddress });

    useEffect(() => {
        if (!tokenAddressFetched) return;
        setTokenAddress(tokenAddressFetched);
    }, [tokenAddressFetched]);

    return (
        <ButtonRipple
            className={styles.buttonMintCommunity}
            onClick={async () => {
                if (!tokenAddressFetched) return;
                await mutateAsync({ tokenAddress: tokenAddressFetched });
            }}
            isLoading={isPending}
            disabled={isPending || !tokenAddressFetched}
        >
            <span>
                Join <strong>{name}</strong> community
            </span>
        </ButtonRipple>
    );
}
