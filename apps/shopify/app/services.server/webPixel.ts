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
 * Create the web pixel
 */
export async function createWebPixel({
    admin: { graphql },
}: AuthenticatedContext): Promise<CreateWebPixelReturnType> {
    const response = await graphql(`
mutation {
  webPixelCreate(webPixel: { settings: "{}" }) {
    userErrors {
      field
      message
    }
    webPixel {
      id
      settings
    }
  }
}`);
    const {
        data: { webPixelCreate },
    } = await response.json();

    return webPixelCreate;
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
