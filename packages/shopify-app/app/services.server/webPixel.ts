import type { AuthenticatedContext } from "app/types/context";

export type WebPixelReturnType = {
    userErrors: {
        code: string;
        field: string;
        message: string;
    }[];
    webPixel: {
        id: string;
        settings: string;
    };
};

/**
 * Activate the web pixel
 */
export async function activateWebPixel({
    admin: { graphql },
}: AuthenticatedContext): Promise<WebPixelReturnType> {
    const response = await graphql(`
mutation {
  webPixelCreate(webPixel: { settings: "{}" }) {
    userErrors {
      code
      field
      message
    }
    webPixel {
      settings
      id
    }
  }
}`);
    const {
        data: { webPixelCreate },
    } = await response.json();

    return webPixelCreate;
}
