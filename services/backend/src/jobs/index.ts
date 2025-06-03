import Elysia from "elysia";
import { interactionsJobs } from "./interactions";
import { oracleJobs } from "./oracle";
import { pairingJobs } from "./pairing";

export const jobs = new Elysia({ name: "Jobs" })
    .use(pairingJobs)
    .use(interactionsJobs)
    .use(oracleJobs);
