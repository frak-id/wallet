import { WebClient } from "@slack/web-api";
import Airtable from "airtable";
import { log } from "../../common";
import {
    AIRTABLE_CONFIG,
    type AirtableRequestBody,
    type TableType,
} from "./config";
import { mapToAirtableFields } from "./utils";

export class AirtableService {
    private airtable: Airtable;
    private slack?: WebClient;

    constructor() {
        const apiKey = process.env.AIRTABLE_API_KEY;
        if (!apiKey) {
            throw new Error(
                "AIRTABLE_API_KEY environment variable is required"
            );
        }

        this.airtable = new Airtable({ apiKey });

        // Initialize Slack client if token is available
        const slackToken = process.env.SLACK_BOT_TOKEN;
        if (slackToken) {
            this.slack = new WebClient(slackToken);
        }
    }

    /**
     * Check if a record with the given email already exists in the specified table
     */
    async checkDuplicateEmail(
        tableType: TableType,
        email: string
    ): Promise<boolean> {
        const config = AIRTABLE_CONFIG[tableType];
        const base = this.airtable.base(config.baseId);

        try {
            const existingRecords = await base(config.tableId)
                .select({
                    filterByFormula: `{Email} = '${email.replace(/'/g, "\\'")}'`, // Use Airtable field name "Email"
                    maxRecords: 1,
                })
                .firstPage();

            return existingRecords.length > 0;
        } catch (error) {
            throw new Error(`Failed to check for duplicate email: ${error}`);
        }
    }

    /**
     * Create a new record in the specified table
     */
    async createRecord(
        tableType: TableType,
        data: AirtableRequestBody
    ): Promise<string> {
        const config = AIRTABLE_CONFIG[tableType];
        const base = this.airtable.base(config.baseId);

        try {
            // Map request body fields to Airtable field names
            const mappedFields = mapToAirtableFields(data);

            const newRecords = await base(config.tableId).create([
                {
                    fields: mappedFields as Record<
                        string,
                        string | number | boolean
                    >,
                },
            ]);

            const newRecord = newRecords[0];
            return newRecord.id;
        } catch (error) {
            throw new Error(`Failed to create record: ${error}`);
        }
    }

    /**
     * Send a Slack notification about the new record
     */
    async sendSlackNotification(
        tableType: TableType,
        data: AirtableRequestBody
    ): Promise<void> {
        if (!this.slack) {
            log.info("Slack not configured, skipping notification");
            return;
        }

        try {
            const tableName = tableType.replace("_", " ");
            const slackMessage = {
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
            };

            await this.slack.chat.postMessage(slackMessage);
        } catch (error) {
            // Don't fail the main operation if Slack notification fails
            log.error(error, "Failed to send Slack notification:");
        }
    }

    /**
     * Process a complete request: check duplicates, create record, send notification
     */
    async processRequest(
        tableType: TableType,
        data: AirtableRequestBody
    ): Promise<{ recordId: string; message: string }> {
        // Check for duplicates
        const isDuplicate = await this.checkDuplicateEmail(
            tableType,
            data.email
        );
        if (isDuplicate) {
            throw new Error("Record with this email already exists");
        }

        // Create the record
        const recordId = await this.createRecord(tableType, data);

        // Send Slack notification (non-blocking)
        this.sendSlackNotification(tableType, data).catch((error) => {
            log.error(error, "Slack notification failed");
        });

        return {
            recordId,
            message: `Record created successfully in ${tableType} table`,
        };
    }
}
