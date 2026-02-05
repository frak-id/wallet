import { type Db, MongoClient, type ObjectId } from "mongodb";
import type { Address, Hex } from "viem";
import { migrationConfig } from "../config";
import type { V1MongoDBCampaign } from "../types";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

type MongoDBCampaignDocument = {
    _id: ObjectId;
    creator: Address;
    productId?: Hex | "";
    title?: string;
    type?: string;
    specialCategories?: string[];
    budget?: { type?: string; maxEuroDaily?: number };
    territories?: string[];
    bank?: Address | "";
    scheduled?: { dateStart?: Date; dateEnd?: Date };
    rewardChaining?: { userPercent?: number; deperditionPerLevel?: number };
    distribution?: {
        type: string;
        minMultiplier?: number;
        maxMultiplier?: number;
    };
    triggers?: Record<
        string,
        { cac?: number; from?: number; to?: number; maxCountPerUser?: number }
    >;
    setupCurrency?: string;
    state?: { key: string; txHash?: Hex; address?: Address };
};

async function getMongoDb(): Promise<Db> {
    if (cachedDb) return cachedDb;

    cachedClient = new MongoClient(migrationConfig.mongodbUri);
    await cachedClient.connect();
    cachedDb = cachedClient.db(migrationConfig.mongodbDatabase);
    return cachedDb;
}

export async function closeMongoConnection(): Promise<void> {
    if (cachedClient) {
        await cachedClient.close();
        cachedClient = null;
        cachedDb = null;
    }
}

export async function fetchAllMongoDBCampaigns(): Promise<V1MongoDBCampaign[]> {
    const db = await getMongoDb();
    const documents = await db
        .collection<MongoDBCampaignDocument>("campaigns")
        .find({})
        .toArray();
    return documents.map(mapDocumentToCampaign);
}

function mapDocumentToCampaign(
    doc: MongoDBCampaignDocument
): V1MongoDBCampaign {
    return {
        _id: doc._id.toHexString(),
        creator: doc.creator,
        productId: doc.productId ?? "",
        title: doc.title ?? "",
        type: mapGoalType(doc.type),
        specialCategories: mapSpecialCategories(doc.specialCategories),
        budget: {
            type: mapBudgetType(doc.budget?.type),
            maxEuroDaily: doc.budget?.maxEuroDaily ?? 0,
        },
        territories: doc.territories ?? [],
        bank: doc.bank ?? "",
        scheduled: doc.scheduled
            ? {
                  dateStart: doc.scheduled.dateStart ?? new Date(),
                  dateEnd: doc.scheduled.dateEnd,
              }
            : undefined,
        rewardChaining: doc.rewardChaining,
        distribution: mapDistribution(doc.distribution),
        triggers: mapTriggers(doc.triggers),
        setupCurrency: mapCurrency(doc.setupCurrency),
        state: mapState(doc.state),
    };
}

function mapGoalType(type?: string): V1MongoDBCampaign["type"] {
    const validTypes = [
        "awareness",
        "traffic",
        "registration",
        "sales",
        "retention",
    ] as const;
    return validTypes.includes(type as (typeof validTypes)[number])
        ? (type as (typeof validTypes)[number])
        : "";
}

function mapSpecialCategories(
    categories?: string[]
): V1MongoDBCampaign["specialCategories"] {
    if (!categories) return [];
    const valid = ["credit", "jobs", "housing", "social"] as const;
    return categories.filter((c) =>
        valid.includes(c as (typeof valid)[number])
    ) as V1MongoDBCampaign["specialCategories"];
}

function mapBudgetType(type?: string): V1MongoDBCampaign["budget"]["type"] {
    const valid = ["daily", "weekly", "monthly", "global"] as const;
    return valid.includes(type as (typeof valid)[number])
        ? (type as (typeof valid)[number])
        : undefined;
}

function mapDistribution(dist?: {
    type: string;
    minMultiplier?: number;
    maxMultiplier?: number;
}): V1MongoDBCampaign["distribution"] {
    if (!dist) return undefined;
    if (dist.type === "range")
        return {
            type: "range",
            minMultiplier: dist.minMultiplier ?? 0.7,
            maxMultiplier: dist.maxMultiplier ?? 1.3,
        };
    return { type: "fixed" };
}

function mapTriggers(
    triggers?: Record<
        string,
        { cac?: number; from?: number; to?: number; maxCountPerUser?: number }
    >
): V1MongoDBCampaign["triggers"] {
    if (!triggers) return {};
    const result: V1MongoDBCampaign["triggers"] = {};
    for (const [key, value] of Object.entries(triggers)) {
        if (value.cac !== undefined) {
            result[key] = {
                cac: value.cac,
                maxCountPerUser: value.maxCountPerUser,
            };
        } else if (value.from !== undefined && value.to !== undefined) {
            result[key] = {
                from: value.from,
                to: value.to,
                maxCountPerUser: value.maxCountPerUser,
            };
        }
    }
    return result;
}

function mapCurrency(currency?: string): V1MongoDBCampaign["setupCurrency"] {
    const valid = ["eur", "usd", "gbp", "raw"] as const;
    return valid.includes(currency as (typeof valid)[number])
        ? (currency as (typeof valid)[number])
        : undefined;
}

function mapState(state?: {
    key: string;
    txHash?: Hex;
    address?: Address;
}): V1MongoDBCampaign["state"] {
    if (!state) return { key: "draft" };
    if (state.key === "created" && state.txHash && state.address)
        return { key: "created", txHash: state.txHash, address: state.address };
    if (state.key === "creationFailed") return { key: "creationFailed" };
    return { key: "draft" };
}
