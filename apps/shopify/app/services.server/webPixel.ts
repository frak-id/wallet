import type { AuthenticatedContext } from "app/types/context";

export type GetWebPixelReturnType = {
    id: string;
    settings: string;
};

export type CreateWebPixelReturnType = {
    userErrors: {
        field: string;
        message: string;
    }[];
    webPixel: GetWebPixelReturnType;
};

export type DeleteWebPixelReturnType = {
    deletedWebPixelId: string;
    userErrors: {
        code: string;
        field: string;
        message: string;
    }[];
};

export type UpdateWebPixelReturnType = {
    userErrors: {
        field: string;
        message: string;
    }[];
    webPixel: GetWebPixelReturnType;
};

/**
 * Build the pixel settings with the current environment's backend URL.
 */
function buildPixelSettings(): { backendUrl: string } {
    return {
        backendUrl: process.env.BACKEND_URL ?? "",
    };
}

/**
 * Get the web pixel
 */
export async function getWebPixel({
    admin: { graphql },
}: AuthenticatedContext): Promise<GetWebPixelReturnType> {
    const response = await graphql(`
query getWebPixel {
  webPixel {
    id
    settings
  }
}`);
    const {
        data: { webPixel },
    } = await response.json();

    return webPixel;
}

/**
 * Create the web pixel with environment-specific backend URL in settings.
 */
export async function createWebPixel({
    admin: { graphql },
}: AuthenticatedContext): Promise<CreateWebPixelReturnType> {
    const response = await graphql(
        `#graphql
mutation webPixelCreate($webPixel: WebPixelInput!) {
  webPixelCreate(webPixel: $webPixel) {
    userErrors {
      field
      message
    }
    webPixel {
      id
      settings
    }
  }
}`,
        {
            variables: {
                webPixel: {
                    settings: buildPixelSettings(),
                },
            },
        }
    );
    const {
        data: { webPixelCreate },
    } = await response.json();

    return webPixelCreate;
}

/**
 * Update the web pixel settings (e.g. after redeployment with new env URLs).
 */
export async function updateWebPixelSettings({
    admin: { graphql },
    id,
}: AuthenticatedContext & { id: string }): Promise<UpdateWebPixelReturnType> {
    const response = await graphql(
        `#graphql
mutation webPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
  webPixelUpdate(id: $id, webPixel: $webPixel) {
    userErrors {
      field
      message
    }
    webPixel {
      id
      settings
    }
  }
}`,
        {
            variables: {
                id,
                webPixel: {
                    settings: buildPixelSettings(),
                },
            },
        }
    );
    const {
        data: { webPixelUpdate },
    } = await response.json();

    return webPixelUpdate;
}

/**
 * Delete the web pixel
 */
export async function deleteWebPixel({
    admin: { graphql },
    id,
}: AuthenticatedContext & { id: string }): Promise<DeleteWebPixelReturnType> {
    const response = await graphql(
        `
mutation deleteWebPixel($id: ID!) {
  webPixelDelete(id: $id) {
    deletedWebPixelId
    userErrors {
      code
      field
      message
    }
  }
}`,
        {
            variables: {
                id,
            },
        }
    );
    const {
        data: { webPixelDelete },
    } = await response.json();

    return webPixelDelete;
}
