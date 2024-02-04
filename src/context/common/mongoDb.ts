"use server";

import { DI } from "@/context/common/di";
import { MongoClient } from "mongodb";
import {Config} from "sst/node/config";

// Get the mongo db client
export const getMongoDb = DI.registerAndExposeGetter({
    id: "Mongo",
    isAsync: true,
    getter: async () => {
        // Get the mongo client
        const client = new MongoClient(
            Config.MONGODB_FRAK_POC_URI as string
        );
        // Connect to the database
        await client.connect();
        // and then connect to the poc database
        return client.db("poc");
    },
});
