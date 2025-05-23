/**
 * Mapping from request body field names to Airtable field names
 */
export const AIRTABLE_FIELD_MAPPING: Record<string, string> = {
    lastName: "Last Name",
    firstName: "First Name",
    company: "Company",
    phone: "Phone",
    email: "Email",
    url: "Company Website URL",
    position: "Position",
    country: "Country",
    visits: "Average Website Visitors",
    channels: "Acquisition Channels",
} as const;

/**
 * Generic function to map request body fields to Airtable field names
 */
export function mapToAirtableFields(
    data: RequestBody
): Record<string, unknown> {
    const mappedFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        // Skip undefined values
        if (value === undefined) {
            continue;
        }

        const airtableFieldName = AIRTABLE_FIELD_MAPPING[key];
        if (airtableFieldName) {
            // Handle array fields (like channels) by joining them with comma
            if (Array.isArray(value)) {
                mappedFields[airtableFieldName] = value.join(", ");
            } else {
                mappedFields[airtableFieldName] = value;
            }
        } else {
            // If no mapping found, log a warning but still include the field
            console.warn(`No Airtable field mapping found for key: ${key}`);
            mappedFields[key] = value;
        }
    }

    return mappedFields;
}
