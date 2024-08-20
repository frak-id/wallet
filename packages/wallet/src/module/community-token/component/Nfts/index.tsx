"use client";

import { contentIds } from "@/context/blockchain/contentIds";
import { AccordionJoinCommunity } from "@/module/community-token/component/AccordionJoinCommunity";
import { ButtonMintCommunity } from "@/module/community-token/component/ButtonMintCommunity";
import { SliderNfts } from "@/module/community-token/component/SliderNfts";
import styles from "./index.module.css";

export function Nfts() {
    return (
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
    );
}
