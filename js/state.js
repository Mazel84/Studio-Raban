// js/state.js
import { ROLES } from './config.js';

export const State = {
    user: null,
    activeSeasonId: null,
    impersonatedRole: null,
    data: { jobs: [], seasons: [], extraCosts: [], users: [], globalBudgets: [] },

    financeViewMode: 'production', // 'production' lub 'global'
    
    getCurrentRole: () => State.impersonatedRole || (State.user ? State.user.role : ROLES.REPORTER),
    
    getActiveSeason: () => State.data.seasons.find(s => s.id === State.activeSeasonId) || State.data.seasons[0],
    
    getFilteredJobs: () => {
        const sId = State.activeSeasonId;
        let jobs = State.data.jobs;
        if (sId) jobs = jobs.filter(j => j.seasonId === sId);
        return jobs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
};