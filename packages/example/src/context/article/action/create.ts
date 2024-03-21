"use server";

import { randomBytes } from "node:crypto";
import { onlyAdmin } from "@/context/admin/action/authenticate";
import { getArticleRepository } from "@/context/article/repository/ArticleRepository";
import { getContentRepository } from "@/context/article/repository/ContentRepository";
import { contentId } from "@/context/common/config";
import { revalidateTag } from "next/cache";
import { keccak256 } from "viem";

/**
 * Map of content article id to le monde article
 */
type ArticleIdKeys = 1 | 2 | 3;
type LocalArticleDef = {
    title: string;
    description?: string;
};
const articlesMap: Record<
    "le-monde" | "wired" | "l-equipe",
    Record<ArticleIdKeys, LocalArticleDef | undefined>
> = {
    "le-monde": {
        1: {
            title: "Le Cambodge mise sur la blockchain pour réduire sa dépendance au dollar",
            description:
                "La banque centrale du royaume a développé un système de paiement mobile accessible aux Cambodgiens ne disposant pas de compte en banque.",
        },
        2: {
            title: "Les NFT font leur entrée au Centre Pompidou",
            description:
                "Des dons et des acquisitions d’œuvres de crypto art, de Net art ou encore d’art génératif viennent enrichir les collections nationales et donneront lieu à une exposition en avril.",
        },
        3: {
            title: "Une technologie qui révolutionne la finance",
            description:
                "La « blockchain », technologie de stockage numérique décentralisée, peut bouleverser les marchés financiers en supprimant les intermédiaires et en réduisant fortement les coûts de transaction.",
        },
    },
    wired: {
        1: {
            title: "Apple’s Killing the Password. Here’s Everything You Need to Know",
            description:
                "With iOS 16 and macOS Ventura, Apple is introducing passkeys—a more convenient and secure alternative to passwords.",
        },
        2: {
            title: "Google Steps Up Its Push to Kill the Password",
            description:
                "Google is making passkeys, the emerging passwordless login technology, the default option for users as it moves to make passwords “obsolete.”",
        },
        3: {
            title: "How to Be More Anonymous Online",
            description:
                "Being fully anonymous is next to impossible—but you can significantly limit what the internet knows about you by sticking to a few basic rules.",
        },
    },
    "l-equipe": {
        1: {
            title: "Ces petites choses invisibles qui font de Rudy Gobert une superstar de la défense en NBA",
            description:
                "S'il ne brille que rarement en attaque, Rudy Gobert est un défenseur émérite et reconnu. Au point d'être considéré comme une superstar NBA ? Sans avoir l'aura d'un LeBron James ou d'un Stephen Curry, il a le même impact sur le jeu, affirme l'un de ses coéquipiers. Nous avons voulu vérifier.",
        },
        2: undefined,
        3: undefined,
    },
};

/**
 * Setup simple test data for the article
 */
export async function createArticle({
    id,
    provider,
    origin,
    isLocal,
}: {
    id: number;
    provider: "le-monde" | "wired" | "l-equipe";
    origin: string;
    isLocal: boolean;
}) {
    // Lock this function to admin only
    await onlyAdmin();
    // Insert the test content
    const contentRepository = await getContentRepository();
    const content = await contentRepository.getById(contentId);

    // Ensure we got an article definition
    const articleDef = articlesMap[provider][id as ArticleIdKeys];
    if (!articleDef) {
        throw new Error(`Invalid article provider ${provider} or id ${id}`);
    }

    // Generate a random article id
    const articleId = keccak256(randomBytes(64));

    // Insert a test article for this content
    const articleRepository = await getArticleRepository();
    await articleRepository.create({
        _id: articleId,
        contentId: content._id,
        provider,
        title: `${isLocal ? "[DEV] " : ""}${articleDef.title}`,
        description: articleDef.description,
        link: `${origin}/article?id=${articleId}`,
        imageUrl: `${origin}/_articles/${provider}-img-${id}.${
            provider === "le-monde" || provider === "l-equipe" ? "jpeg" : "webp"
        }`,
        lockedContentUrl: `${origin}/_articles/${provider}-locked-${id}.html`,
        unlockedContentUrl: `${origin}/_articles/${provider}-unlocked-${id}.html`,
    });

    // Reset the cache for all the articles fetching
    revalidateTag("get-articles");

    // And return the article id
    return articleId;
}
