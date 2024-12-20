import "./styles.css";
import { onDocumentReady } from "@frak-labs/shared/module/utils/onDocumentReady";
import { Roulette } from "./vanillaRoulette";

interface Prize {
    index: number;
}

interface RouletteEvent {
    detail: {
        prize: Prize;
    };
}

const walletUrl =
    process.env.NODE_ENV === "production"
        ? "https://wallet-dev.frak.id"
        : "https://localhost:3000";

window.FrakSetup = {
    config: {
        walletUrl,
        metadata: {
            name: "Your App Name",
        },
    },
};

onDocumentReady(() => {
    const options = {
        spacing: 0,

        acceleration: 1000,

        // fps: 40,

        audio: undefined,

        // selector: ":scope > *",

        stopCallback: ({ detail: { prize } }: RouletteEvent) => {
            console.log("stop");
            console.log(`Selected prize index is: ${prize.index}`);
        },

        startCallback: ({ detail: { prize } }: RouletteEvent) => {
            console.log("start");
            console.log(`Selected prize index is: ${prize.index}`);
        },
    };

    const roulette = new Roulette(".roulette", options);

    document.getElementById("start")?.addEventListener("click", () => {
        roulette.rotateTo(7, { tracks: 1, random: true });
    });
});
