import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { ExplorerCard } from "@/module/explorer/component/ExplorerCard";
import { useGetExplorerMerchants } from "@/module/explorer/hook/useGetExplorerMerchants";
import {
    favoritesStore,
    selectFavorites,
} from "@/module/favorites/stores/favoritesStore";
import * as styles from "./index.css";

export function FavoritesPage() {
    const { t } = useTranslation();
    const favorites = useStore(favoritesStore, selectFavorites);

    // Favorites are frontend-only ids, so resolve them against the Explorer
    // list (pull a wide page to cover most catalogs without pagination). A
    // proper `merchants-by-id` endpoint would remove this cap and the empty
    // vs. unresolved ambiguity below.
    const { merchants, isLoading, error, refetch } = useGetExplorerMerchants({
        limit: 100,
    });

    const favoriteMerchants = useMemo(
        () => merchants.filter((merchant) => favorites[merchant.id]),
        [merchants, favorites]
    );
    const hasFavorites = Object.keys(favorites).length > 0;

    return (
        <Stack space="m">
            <Back href="/profile" />
            <Title size="page">{t("favorites.pageTitle")}</Title>

            {!hasFavorites ? (
                // Genuinely nothing favorited yet.
                <EmptyState
                    title={t("favorites.empty.title")}
                    description={t("favorites.empty.description")}
                />
            ) : isLoading ? (
                <Stack space="m">
                    <Skeleton variant="rect" height={240} width="100%" />
                    <Skeleton variant="rect" height={240} width="100%" />
                </Stack>
            ) : error ? (
                // The fetch failed — retry can genuinely recover this.
                <EmptyState
                    title={t("favorites.error.title")}
                    description={t("favorites.error.description")}
                    action={{
                        label: t("favorites.error.retry"),
                        onClick: () => refetch(),
                    }}
                />
            ) : favoriteMerchants.length === 0 ? (
                // Fetch succeeded but no favorite resolved (all delisted or
                // ranked beyond the fetched page). Not an error, and retry is
                // futile — give it honest copy without a retry action.
                <EmptyState
                    title={t("favorites.unavailable.title")}
                    description={t("favorites.unavailable.description")}
                />
            ) : (
                <Stack as="ul" space="m" className={styles.list}>
                    {favoriteMerchants.map((merchant) => (
                        <li key={merchant.id}>
                            <ExplorerCard merchant={merchant} />
                        </li>
                    ))}
                </Stack>
            )}
        </Stack>
    );
}
