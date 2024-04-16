"use client";

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
                        contentId={0}
                    />
                    <ButtonMintCommunity
                        name="L'équipe"
                        image={"l-equipe.png"}
                        contentId={1}
                    />
                    <ButtonMintCommunity
                        name="Wired"
                        image={"wired.png"}
                        contentId={2}
                    />
                </AccordionJoinCommunity>
            </div>
        </EnforceChain>
    );
}
