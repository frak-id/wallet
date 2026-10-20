import { DropRepository } from "./repositories/DropRepository";

const dropRepository = new DropRepository();

export namespace GameContext {
    export const repositories = {
        drop: dropRepository,
    };
}
