import { HeartIcon, HeartOutlineIcon } from "@frak-labs/design-system/icons";
import { type MouseEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
    favoritesStore,
    selectIsFavorite,
} from "@/module/favorites/stores/favoritesStore";
import * as styles from "./index.css";

type FavoriteButtonProps = {
    merchantId: string;
};

function prefersReducedMotion() {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

/**
 * Heart toggle overlaid on an Explorer card. Outline when idle, solid once
 * favorited. Stops propagation so tapping it never opens the card's detail.
 */
export function FavoriteButton({ merchantId }: FavoriteButtonProps) {
    const { t } = useTranslation();
    const isFavorite = useStore(favoritesStore, selectIsFavorite(merchantId));
    const toggleFavorite = useStore(
        favoritesStore,
        (state) => state.toggleFavorite
    );
    const [isPopping, setIsPopping] = useState(false);

    const handleClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            // Celebrate the add only. Skip under reduced motion, where the CSS
            // animation is disabled and onAnimationEnd would never fire to
            // clear the flag.
            if (!isFavorite && !prefersReducedMotion()) setIsPopping(true);
            toggleFavorite(merchantId);
        },
        [isFavorite, merchantId, toggleFavorite]
    );

    const Icon = isFavorite ? HeartIcon : HeartOutlineIcon;

    return (
        <button
            type="button"
            className={styles.button}
            onClick={handleClick}
            aria-pressed={isFavorite}
            aria-label={t(isFavorite ? "favorites.remove" : "favorites.add")}
        >
            <Icon
                width={24}
                height={24}
                className={
                    isPopping ? `${styles.icon} ${styles.iconPop}` : styles.icon
                }
                onAnimationEnd={() => setIsPopping(false)}
            />
        </button>
    );
}
