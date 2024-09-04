import { DI } from "@frak-labs/shared/context/utils/di";
import { isRunningInProd } from "@frak-labs/shared/context/utils/env";
import { MongoClient } from "mongodb";

// Get the mongo db client
export const getMongoDb = DI.registerAndExposeGetter({
    id: "Mongo",
    isAsync: true,
    getter: async () => {
        // Get the mongo client
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
