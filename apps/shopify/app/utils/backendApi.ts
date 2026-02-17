import ky from "ky";

export const backendApi = ky.create({ prefixUrl: process.env.BACKEND_URL });
