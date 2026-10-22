import { GameRepository } from "./repositories/GameRepository";

const gameRepository = new GameRepository();

export namespace GameContext {
    export const repositories = {
        game: gameRepository,
    };
}
