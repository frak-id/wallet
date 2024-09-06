"use client";

import { Player } from "@lottiefiles/react-lottie-player";
import { Link } from "next-view-transitions";
import lottie from "./assets/lottie.json";

export function Lottie({ className }: { className?: string }) {
    return (
        <div className={className}>
            <Link href={process.env.NEXUS_WALLET_URL as string}>
                <Player
                    src={lottie}
                    autoplay
                    loop={false}
                    speed={1}
                    style={{ width: "33px" }}
                />
            </Link>
        </div>
    );
}
