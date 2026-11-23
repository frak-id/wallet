import { log } from "@backend-infrastructure/external/logger";
import ky, { type KyInstance } from "ky";
import { slackClient } from "../slack";
import {
    AIRTABLE_CONFIG,
    type AirtableRequestBody,
    type TableType,
} from "./config";
import { mapToAirtableFields } from "./utils";

type AirtableRecord = {
    id: string;
    createdTime: string;
    fields: Record<string, unknown>;
};

type AirtableListResponse = {
    records: AirtableRecord[];
    offset?: string;
};

type AirtableCreateResponse = {
    records: AirtableRecord[];
};

export class AirtableRepository {
    private readonly airtableApi: KyInstance;

    constructor() {
        const apiKey = process.env.AIRTABLE_API_KEY;
        if (!apiKey) {
            throw new Error(
                "AIRTABLE_API_KEY environment variable is required"
            );
        }

        // Rate limit: 5 req/sec per base, retry on 429 and 503
        this.airtableApi = ky.create({
            prefix: "https://api.airtable.com/v0",
            headers: { Authorization: `Bearer ${apiKey}` },
            retry: {
                limit: 3,
                statusCodes: [429, 503],
                backoffLimit: 30_000,
            },
        });
    }

    async checkDuplicateEmail(
        tableType: TableType,
        email: string
    ): Promise<boolean> {
        const config = AIRTABLE_CONFIG[tableType];

        try {
            const response = await this.airtableApi
                .get(`${config.baseId}/${config.tableId}`, {
                    searchParams: {
                        filterByFormula: `{Email} = '${email.replace(/'/g, "\\'")}'`,
                        maxRecords: 1,
                    },
                })
                .json<AirtableListResponse>();

            return response.records.length > 0;
        } catch (error) {
            throw new Error(`Failed to check for duplicate email: ${error}`);
        }
    }

    async createRecord(
        tableType: TableType,
        data: AirtableRequestBody
    ): Promise<string> {
        const config = AIRTABLE_CONFIG[tableType];

        try {
            const mappedFields = mapToAirtableFields(data);

            const response = await this.airtableApi
                .post(`${config.baseId}/${config.tableId}`, {
                    json: {
                        records: [{ fields: mappedFields }],
                    },
                })
                .json<AirtableCreateResponse>();

            return response.records[0].id;
        } catch (error) {
            throw new Error(`Failed to create record: ${error}`);
        }
    }

    async sendSlackNotification(
        tableType: TableType,
        data: AirtableRequestBody
    ): Promise<void> {
        const tableName = tableType.replace("_", " ");
        await slackClient.postMessage({
            channel: "crm",
            text: `New *${tableName}* record created`,
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Email: ${data.email}*`,
                    },
                },
                {
                    type: "section",
                    fields: Object.entries(data)
                        .filter(([key]) => key !== "email")
                        .slice(0, 8) // Limit to 8 fields to avoid Slack limits
                        .map(([key, value]) => ({
                            type: "mrkdwn",
                            text: `*${key}:* ${String(value)}`,
                        })),
                },
            ],
        });
    }

    async processRequest(
        tableType: TableType,
        data: AirtableRequestBody
    ): Promise<{ recordId: string; message: string }> {
        const isDuplicate = await this.checkDuplicateEmail(
            tableType,
            data.email
        );
        if (isDuplicate) {
            throw new Error("Record with this email already exists");
        }

        const recordId = await this.createRecord(tableType, data);

        try {
            await this.sendSlackNotification(tableType, data);
        } catch (error) {
            log.error(error, "Slack notification failed");
        }

        return {
            recordId,
            message: `Record created successfully in ${tableType} table`,
        };
    }
}
