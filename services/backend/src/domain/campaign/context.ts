import { RewardsContext } from "../rewards/context";
import { CampaignRuleRepository } from "./repositories/CampaignRuleRepository";
import { CampaignManagementService } from "./services/CampaignManagementService";
import { EstimatedRewardService } from "./services/EstimatedRewardService";
import { RewardCalculator } from "./services/RewardCalculator";
import { RuleConditionEvaluator } from "./services/RuleConditionEvaluator";
import { RuleEngineService } from "./services/RuleEngineService";

const campaignRuleRepository = new CampaignRuleRepository();
const ruleConditionEvaluator = new RuleConditionEvaluator();
const rewardCalculator = new RewardCalculator(ruleConditionEvaluator);
const ruleEngineService = new RuleEngineService(
    campaignRuleRepository,
    ruleConditionEvaluator,
    rewardCalculator,
    RewardsContext.repositories.assetLog
);
const campaignManagementService = new CampaignManagementService(
    campaignRuleRepository
);
const estimatedRewardService = new EstimatedRewardService(
    campaignRuleRepository
);

export namespace CampaignContext {
    export const repositories = {
        campaignRule: campaignRuleRepository,
    };

    export const services = {
        ruleConditionEvaluator: ruleConditionEvaluator,
        rewardCalculator: rewardCalculator,
        ruleEngine: ruleEngineService,
        management: campaignManagementService,
        estimatedReward: estimatedRewardService,
    };
}
