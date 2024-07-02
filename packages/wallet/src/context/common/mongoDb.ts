import { DI } from "@frak-labs/shared/context/utils/di";
import { MongoClient } from "mongodb";

// Get the mongo db client
export const getMongoDb = DI.registerAndExposeGetter({
    id: "Mongo",
    isAsync: true,
    getter: async () => {
        // Get the mongo client
        const client = new MongoClient(process.env.MONGODB_NEXUS_URI as string);
        // Connect to the database
        await client.connect();
        // and then connect to the poc database
        return client.db("nexus");
    },
});
