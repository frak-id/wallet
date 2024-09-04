import { MongoClient } from "mongodb";
import { memo } from "radash";

// Get the mongo db client
export const getMongoDb = memo(
    async () => {
        // Get the mongo client
        const client = new MongoClient(process.env.MONGODB_NEXUS_URI as string);
        // Connect to the database
        await client.connect();
        // and then connect to the poc database
        return client.db("nexus");
    },
    { key: () => "MongoDB" }
);
