"use server";

import { DI } from "@/context/common/di";
import { MongoClient } from "mongodb";

// Get the mongo db client
export const getMongoDb = DI.registerAndExposeGetter({
    id: "Mongo",
    isAsync: true,
    getter: async () => {
        // Get the mongo client
        // TODO: Should use Config.MONGODB_FRAK_POC_URI instead, but next isn't happy about it
        const client = new MongoClient(
            process.env.MONGODB_FRAK_POC_URI as string
        );
        // Connect to the database
        await client.connect();
        // and then connect to the poc database
        return client.db("poc-example");
    },
});
