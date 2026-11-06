import { clsx } from "clsx";
import type { ReactNode } from "react";
import { block } from "../components/block.css";
import type { SceneArtProps, SceneId } from "../contracts";
import { FeedBrand } from "./FeedBrand";
import { FeedFriend } from "./FeedFriend";
import { StoreHero } from "./StoreHero";
import { StoryShot } from "./StoryShot";

const scenes: Record<SceneId, { viewBox: string; Draw: () => ReactNode }> = {
    storeHero: { viewBox: "0 0 400 500", Draw: StoreHero },
    storyShot: { viewBox: "0 0 360 640", Draw: StoryShot },
    feedBrand: { viewBox: "0 0 400 400", Draw: FeedBrand },
    feedFriend: { viewBox: "0 0 400 500", Draw: FeedFriend },
};

export function SceneArt({ scene, className }: SceneArtProps) {
    const { viewBox, Draw } = scenes[scene];
    return (
        <svg
            className={clsx(block, className)}
            width="100%"
            height="100%"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
        >
            <Draw />
        </svg>
    );
}
