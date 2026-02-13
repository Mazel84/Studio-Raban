// js/ui.js
import { Utils, SafeDOM } from './utils.js';
import { State } from './state.js';
import { STATUS_MAP } from './config.js';
import { Permissions, CostCalculator } from './logic.js';

export const UI = {
    openModal: (id) => SafeDOM.get(id)?.classList.add('open'),
    closeModal: (id) => SafeDOM.get(id)?.classList.remove('open'),
    toggleLoader: (show) => SafeDOM.setVisible('loader', show),

    toast: (msg, type = 'normal') => {
        const container = SafeDOM.get('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerText = msg;
        if (type === 'error') el.style.border = '1px solid var(--ios-red)';
        container.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    },

    renderJobCard: (job) => {
        const role = State.getCurrentRole();
        const isPax = Permissions.isPax(role);
        const isEditable = Permissions.canManageJobs(role);
        const totalCost = CostCalculator.calculateJobTotal(job);

        let status = Object.values(STATUS_MAP).find(s => s.id === job.status) || { css: '', label: job.status };

        // Resolve Author Name
        const authorUser = State.data.users.find(u => u.email === job.author);
        const reporterName = authorUser ? authorUser.name : (job.author || 'Nieznany');

        const div = document.createElement('div');
        div.className = 'job-card';

        const costBadge = (Permissions.canManageBudget(role) && totalCost > 0)
            ? `<span class="job-cost-badge">${totalCost} PLN</span>`
            : '';

        const paxComment = job.paxComment
            ? `<div class="job-pax-comment"><span class="material-symbols-outlined" style="font-size:13px; vertical-align: -2px;">comment</span> PAX: ${Utils.escape(job.paxComment)}</div>`
            : '';

        const locationHtml = job.location
            ? `<div class="job-location"><span class="material-symbols-outlined" style="font-size:14px; vertical-align:-3px;">location_on</span> ${Utils.escape(job.location)}</div>`
            : '';

        div.innerHTML = `
            <div class="job-card-header">
                <div class="job-card-meta">
                    <span class="status-badge ${status.css}">${status.label}</span>
                    <span class="job-date">${Utils.escape(job.date)}</span>
                    <span class="job-separator">•</span>
                    <span class="job-reporter">${Utils.escape(reporterName)}</span>
                    ${costBadge}
                </div>
            </div>
            <div class="job-title">${Utils.escape(job.title)}</div>
            ${locationHtml}
            ${paxComment}
            ${UI._renderCrewList(job.crew)}
            ${UI._renderCardActions(job, isPax, isEditable)}
        `;
        return div;
    },

    _renderCrewList: (crew) => {
        if (!crew || !crew.length) return '';
        const items = crew.map(c => {
            const nameEsc = Utils.escape(c.name);
            const roleEsc = Utils.escape(c.role);
            if (!nameEsc && !roleEsc) return '';

            const phoneLink = c.phone
                ? `<a href="tel:${Utils.escape(c.phone)}" class="crew-phone-link">
                    <span class="material-symbols-outlined" style="font-size:13px;">call</span>
                   </a>`
                : '';

            return `<div class="crew-member-pill">
                <span class="crew-role-pill">${roleEsc || 'Rola'}</span>
                <span class="crew-name-text">${nameEsc || 'Brak'}</span>
                ${phoneLink}
            </div>`;
        }).filter(s => s).join('');

        return items ? `<div class="crew-list-container">${items}</div>` : '';
    },

    _renderCardActions: (job, isPax, isEditable) => {
        if (isPax && job.status === STATUS_MAP.PENDING.id) {
            return `
                <div class="job-actions">
                    <button type="button" onclick="window.App.handlePaxDecision('${job.id}', false)" class="job-btn job-btn-reject">
                        <span class="material-symbols-outlined" style="font-size:16px;">close</span> Odrzuć
                    </button>
                    <button type="button" onclick="window.App.handlePaxDecision('${job.id}', true)" class="job-btn job-btn-approve">
                        <span class="material-symbols-outlined" style="font-size:16px;">check</span> Akceptuj
                    </button>
                </div>`;
        } else if (isEditable) {
            return `
                <div class="job-actions">
                    <button type="button" onclick="window.App.openEditJob('${job.id}')" class="job-btn job-btn-edit">
                        <span class="material-symbols-outlined" style="font-size:15px;">edit</span> Edytuj
                    </button>
                </div>`;
        }
        return '';
    }
};