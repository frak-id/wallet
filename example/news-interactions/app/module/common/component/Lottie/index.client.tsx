import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { Player } from "@lottiefiles/react-lottie-player";
import { useState } from "react";
import { Link } from "react-router";
import lottie from "./assets/lottie.json";
import styles from "./index.module.css";

export function Lottie({ className }: { className?: string }) {
    const [playerState, setPlayerState] = useState<"complete" | undefined>();
    // Get the wallet status
    const { data: walletStatus } = useWalletStatus();

    if (walletStatus?.key !== "connected") {
        return null;
    }

    return (
        <div
            className={`${className} ${playerState === "complete" ? styles.lottie__complete : ""}`}
        >
            <Link to={process.env.FRAK_WALLET_URL as string} target={"_blank"}>
                <Player
                    src={lottie}
                    autoplay
                    loop={3}
                    speed={1}
                    style={{ width: "33px" }}
                    onEvent={(event) =>
                        event === "complete" && setPlayerState("complete")
                    }
                />
            </Link>
        </div>
    );
}
