// js/logic.js
import { ROLES } from './config.js';
import { Utils } from './utils.js';

export const Permissions = {
    canManageBudget: (role) => [ROLES.PRODUCTION, ROLES.PRODUCER, ROLES.ADMIN].includes(role),
    canManageJobs: (role) => [ROLES.PRODUCTION, ROLES.PRODUCER, ROLES.ADMIN, ROLES.REPORTER].includes(role),
    isPax: (role) => [ROLES.PAX, ROLES.ADMIN].includes(role),
    isAdmin: (role) => role === ROLES.ADMIN
};

export const CostCalculator = {
    calculateJobTotal: (job) => {
        if (job.manualCost && parseFloat(job.manualCost) > 0) {
            return Utils.safeNumber(job.manualCost);
        }
        const crewCost = (job.crew || []).reduce((acc, c) => acc + Utils.safeNumber(c.cost), 0);
        const logisticsCost = Utils.safeNumber(job.logistics?.hotel?.cost) + Utils.safeNumber(job.logistics?.transport?.cost);
        return crewCost + logisticsCost;
    }
};