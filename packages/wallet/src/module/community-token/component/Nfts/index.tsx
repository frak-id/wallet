"use client";

import { contentIds } from "@/context/blockchain/contentIds";
import { EnforceChain } from "@/module/chain/component/EnforceChain";
import { AccordionJoinCommunity } from "@/module/community-token/component/AccordionJoinCommunity";
import { ButtonMintCommunity } from "@/module/community-token/component/ButtonMintCommunity";
import { SliderNfts } from "@/module/community-token/component/SliderNfts";
import { arbitrumSepolia } from "viem/chains";
import styles from "./index.module.css";

export function Nfts() {
    return (
        <EnforceChain
            targetChainId={arbitrumSepolia.id}
            wantedAction={"manage your communities"}
        >
            <div className={styles.nfts}>
                <SliderNfts />

                <AccordionJoinCommunity trigger={<span>Join</span>}>
                    <ButtonMintCommunity
                        name="Le Monde"
                        image={"le-monde.png"}
                        contentId={contentIds["le-monde"]}
                    />
                    <ButtonMintCommunity
                        name="L'équipe"
                        image={"l-equipe.png"}
                        contentId={contentIds.equipe}
                    />
                    <ButtonMintCommunity
                        name="Wired"
                        image={"wired.png"}
                        contentId={contentIds.wired}
                    />
                </AccordionJoinCommunity>
            </div>
        </EnforceChain>
    );
}
