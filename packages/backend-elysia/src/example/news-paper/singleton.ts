import type { Elysia } from "elysia";
import { sleep } from "radash";

const getMongoDb = async () => {
    console.log("Mongo db resolving");
    await sleep(200);
    console.log("Mongo db resolved");
    return "dbInstance";
};

/**
 * todo: this isn't working, find our why
 */
export const newsPaperSingletons = async (app: Elysia) => {
    console.log("Async context loaded");
    return app
        .decorate({
            dbInstance: await getMongoDb(),
            test: "randomTest",
        })
        .get("/hi", "hi from async ")
        .as("plugin");
};

export default newsPaperSingletons;
