"use client";

import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { AarcProvider, useAarc } from "@aarc-xyz/deposit-widget";
import Coinbase from "@aarc-xyz/deposit-widget-coinbase";
import Transak from "@aarc-xyz/deposit-widget-transak";
import "@aarc-xyz/deposit-widget/dist/style.css";
import { useMemo } from "react";
import { useChainId } from "wagmi";

/**
 * Deposit widget easing the deposit flow with tanstack
 * @constructor
 */
export function AarcDeposit() {
    /**
     * Current chain and wallet
     */
    const chainId = useChainId();

    /**
     * The wallet
     */
    const { smartWallet } = useWallet();

    /**
     * The Aarc config
     */
    const aarcConfig = useMemo(() => {
        // If no smart wallet yet, no onramp config
        if (!smartWallet) return null;

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
                walletAddress: smartWallet.address,
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
    }, [chainId, smartWallet]);

    if (!aarcConfig) return <h2>Loading</h2>;

    return (
        <AarcProvider config={aarcConfig}>
            <>
                <Panel size={"normal"} variant={"primary"}>
                    Current chain: {chainId}
                </Panel>
                <Panel size={"normal"} variant={"primary"}>
                    Smart wallet: {smartWallet?.address}
                </Panel>
            </>

            <DepositButton />
        </AarcProvider>
    );
}

function DepositButton() {
    const deposit = useAarc();

    return (
        <Panel size={"normal"} variant={"empty"}>
            <ButtonRipple onClick={deposit}>Deposit</ButtonRipple>
        </Panel>
    );
}
