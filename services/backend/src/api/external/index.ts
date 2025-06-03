import { Elysia } from "elysia";
import { productsApi } from "./products";

export const externalApi = new Elysia({ prefix: "/ext" }).use(productsApi);
