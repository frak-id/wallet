"use client";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { AarcProvider, useAarc } from "@aarc-xyz/deposit-widget";
import Coinbase from "@aarc-xyz/deposit-widget-coinbase";
import Transak from "@aarc-xyz/deposit-widget-transak";
import "@aarc-xyz/deposit-widget/dist/style.css";
import { CreditCard } from "lucide-react";
import { type PropsWithChildren, useMemo } from "react";
import { useAccount, useChainId } from "wagmi";

/**
 * Our onramping widget
 * @constructor
 */
export function OnRampWidget() {
    return (
        <Panel variant={"empty"} size={"none"}>
            <AarcProviderComponent>
                <DepositCryptoBtn />
            </AarcProviderComponent>
        </Panel>
    );
}

function AarcProviderComponent({ children }: PropsWithChildren) {
    const chainId = useChainId();
    const { address } = useAccount();

    /**
     * The Aarc config
     */
    const aarcConfig = useMemo(() => {
        // If no smart wallet yet, no onramp config
        if (!address) return null;

        return {
            modules: {
                // @ts-ignore
                Transak: (props) => <Transak {...props} />,
                // @ts-ignore
                Coinbase: (props) => <Coinbase {...props} />,
            },
            destination: {
                chainId,
                tokenAddress: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
                walletAddress: address,
                tokenSymbol: "USDC",
                tokenDecimals: 6,
            },
            appearance: {
                logoUrl: "/favicons/icon-512.png",
                themeColor: "#001432",
            },
            apiKeys: {
                transak: process.env.TRANSAK_API_KEY,
                aarcSDK: process.env.AARC_API_KEY,
            },
        };
    }, [chainId, address]);

    // If no config yet, return a loading indicator
    if (!aarcConfig) return <h2>Loading</h2>;

    return <AarcProvider config={aarcConfig}>{children}</AarcProvider>;
}

function DepositCryptoBtn() {
    const deposit = useAarc();

    return (
        <ButtonRipple size={"small"} onClick={deposit}>
            <Title icon={<CreditCard width={32} height={32} />}>
                Deposit Crypto on this wallet
            </Title>
        </ButtonRipple>
    );
}
