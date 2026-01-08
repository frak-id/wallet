import { Elysia } from "elysia";
import { attributionJobs } from "./attribution";
import { pairingJobs } from "./pairing";
import { settlementJobs } from "./settlement";

export const jobs = new Elysia({ name: "Jobs" })
    .use(pairingJobs)
    .use(attributionJobs)
    .use(settlementJobs);
