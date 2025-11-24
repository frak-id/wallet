import { isRunningInProd } from "@frak-labs/app-essentials";
import { createServerOnlyFn } from "@tanstack/react-start";
import { MongoClient } from "mongodb";
import { memo } from "radash";

// Get the mongo db client

export const getMongoDb = createServerOnlyFn(() =>
    memo(
        async () => {
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
        { key: () => "MongoDb" }
    )()
);
