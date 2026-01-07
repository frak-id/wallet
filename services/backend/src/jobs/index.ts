import { Elysia } from "elysia";
import { attributionJobs } from "./attribution";
import { pairingJobs } from "./pairing";

export const jobs = new Elysia({ name: "Jobs" })
    .use(pairingJobs)
    .use(attributionJobs);
