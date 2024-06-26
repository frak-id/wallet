import { DI } from "@/context/common/di";
import { isRunningInProd } from "@/context/common/env";
import { MongoClient } from "mongodb";

// Get the mongo db client
export const getMongoDb = DI.registerAndExposeGetter({
    id: "Mongo",
    isAsync: true,
    getter: async () => {
        // Get the mongo client
        // TODO: Should use Config.MONGODB_FRAK_POC_URI instead, but next isn't happy about it
        const client = new MongoClient(
            process.env.MONGODB_BUSINESS_URI as string
        );
        // Connect to the database
        await client.connect();
        // and then connect to the poc database
        const dbName = isRunningInProd ? "business" : "business-dev";
        return client.db(dbName);
    },
});
