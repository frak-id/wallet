import { Elysia } from "elysia";
import { attributionJobs } from "./attribution";
import { pairingJobs } from "./pairing";
import { rewardCalculationJobs } from "./rewardCalculation";
import { settlementJobs } from "./settlement";

export const jobs = new Elysia({ name: "Jobs" })
    .use(pairingJobs)
    .use(attributionJobs)
    .use(rewardCalculationJobs)
    .use(settlementJobs);
