import type { PublicDraw } from "@frak-labs/backend-elysia/domain/game/schemas";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { skipToken, useQuery } from "@tanstack/react-query";

export const gameDrawKeys = {
    one: (gameId: string) => ["game", "draw", gameId] as const,
};

/** The public draw record: `null` while the game has no draw yet (a 404). */
export function useGameDraw(gameId: string | undefined) {
    return useQuery({
        queryKey: gameDrawKeys.one(gameId ?? ""),
        queryFn: gameId
            ? async (): Promise<PublicDraw | null> => {
                  const { data, error } = await authenticatedBackendApi.common
                      .game({ gameId })
                      .draw.get();
                  if (error?.status === 404) return null;
                  if (error) throw error;
                  return data;
              }
            : skipToken,
    });
}
