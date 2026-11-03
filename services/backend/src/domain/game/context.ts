import { GameDrawRepository } from "./repositories/GameDrawRepository";
import { GameRepository } from "./repositories/GameRepository";

const gameRepository = new GameRepository();
const gameDrawRepository = new GameDrawRepository();

export namespace GameContext {
    export const repositories = {
        game: gameRepository,
        gameDraw: gameDrawRepository,
    };
}
