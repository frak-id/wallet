"use client";

import { EnforceChain } from "@/module/chain/component/EnforceChain";
import { Title } from "@/module/common/component/Title";
import { AccordionJoinCommunity } from "@/module/community-token/component/AccordionJoinCommunity";
import { ButtonMintCommunity } from "@/module/community-token/component/ButtonMintCommunity";
import { SwiperNfts } from "@/module/community-token/component/SwiperNfts";
import { arbitrumSepolia } from "viem/chains";
import styles from "./index.module.css";

export function Nfts() {
    return (
        <EnforceChain
            targetChainId={arbitrumSepolia.id}
            wantedAction={"manage your communities"}
        >
            <div className={styles.nfts}>
                <Title>Presse 🗞</Title>
                <SwiperNfts />
                <AccordionJoinCommunity trigger={<span>Join</span>}>
                    <ButtonMintCommunity name="Le Monde" contentId={0} />
                    <ButtonMintCommunity name="L'équipe" contentId={1} />
                    <ButtonMintCommunity name="Wired" contentId={2} />
                </AccordionJoinCommunity>
            </div>
        </EnforceChain>
    );
}
