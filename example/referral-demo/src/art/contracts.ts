import type { ProductId } from "@/data/merchant";
import type { PersonaId } from "@/data/personas";

/*
 * The illustration kit every surface draws from. All art is inline SVG/CSS:
 * the demo runs offline and must not depend on photos it cannot ship.
 * Every component fills its parent box (width/height 100%) unless sized by a prop.
 */

export type ProductArtProps = {
    productId: ProductId;
    /**
     * `packshot`: product on its tinted studio background (cards, product page).
     * `cutout`: product alone on a transparent background (cart lines, stickers).
     */
    variant?: "packshot" | "cutout";
    className?: string;
};

export type PersonaAvatarProps = {
    persona: PersonaId;
    /** Diameter in px. */
    size: number;
    /** Instagram ring: gradient for an unseen story, grey once seen. */
    ring?: "story" | "seen" | "none";
    className?: string;
};

export type MaisonLuneLogoProps = {
    tone?: "ink" | "paper";
    /** `wordmark` for headers, `monogram` for avatars and favicons. */
    variant?: "wordmark" | "monogram";
    className?: string;
};

export type SceneId =
    /** Store home hero, landscape-ish (4:5 works): the product line on sculpted plinths. */
    | "storeHero"
    /** Léa's story photo, 9:16: the serum held up in warm bathroom light. */
    | "storyShot"
    /** Maison Lune's own feed post, 1:1: flat-lay of the routine. */
    | "feedBrand"
    /** A friend's unrelated feed post, 4:5: Lyon at sunset over the Saône. */
    | "feedFriend";

export type SceneArtProps = {
    scene: SceneId;
    className?: string;
};
