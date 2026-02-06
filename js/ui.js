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
        div.className = 'card';
        
        const costBadge = (Permissions.canManageBudget(role) && totalCost > 0) 
            ? `<span style="font-size:11px; font-weight:700; color:var(--ios-green); background:rgba(48, 209, 88, 0.1); padding:2px 6px; border-radius:4px; margin-left:5px;">${totalCost} PLN</span>` 
            : '';

        const paxComment = job.paxComment ? `<div style="font-size:12px; color:var(--ios-indigo); margin-bottom:5px;">PAX: ${Utils.escape(job.paxComment)}</div>` : '';
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <div>
                    <span class="status-badge ${status.css}">${status.label}</span> 
                    <span style="font-size:11px; color:#888;">${Utils.escape(job.date)}</span>
                    <span style="font-size:11px; color:var(--text-secondary); margin-left: 5px;">| ${Utils.escape(reporterName)}</span>
                    ${costBadge}
                </div>
            </div>
            <h3 style="margin:8px 0; color:white; font-size:16px; text-transform:none;">${Utils.escape(job.title)}</h3>
            <div style="font-size:13px; color:#ccc; margin-bottom:8px;">${Utils.escape(job.location)}</div>
            ${paxComment}
            <div style="margin-top:5px;">${UI._renderCrewList(job.crew)}</div>
            ${UI._renderCardActions(job, isPax, isEditable)}
        `;
        return div;
    },

    _renderCrewList: (crew) => {
        if (!crew || !crew.length) return '';
        return crew.map(c => {
            const nameEsc = Utils.escape(c.name);
            const roleEsc = Utils.escape(c.role);
            if (c.phone) {
                return `<div style="font-size:12px; color:#aaa; margin-top:4px; display:flex; align-items:center; gap:5px;">
                    <span>• ${roleEsc}</span>
                    <a href="tel:${Utils.escape(c.phone)}" style="color:white; font-weight:700; text-decoration:none; border-bottom:1px dotted var(--brand-color); display:flex; align-items:center; gap:4px;">
                        ${nameEsc} <span class="material-symbols-outlined" style="font-size:14px; color:var(--brand-color)">call</span>
                    </a>
                </div>`;
            }
            return `<div style="font-size:12px; color:#aaa; margin-top:2px;">• ${roleEsc} <b>${nameEsc}</b></div>`;
        }).join('');
    },

    _renderCardActions: (job, isPax, isEditable) => {
        if (isPax && job.status === STATUS_MAP.PENDING.id) {
            return `
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button type="button" onclick="window.App.handlePaxDecision('${job.id}', false)" class="btn btn-sm btn-reject" style="flex:1;">Odrzuć</button>
                    <button type="button" onclick="window.App.handlePaxDecision('${job.id}', true)" class="btn btn-sm btn-approve" style="flex:1;">Akceptuj</button>
                </div>`;
        } else if (isEditable) {
            return `<button type="button" onclick="window.App.openEditJob('${job.id}')" class="btn btn-sm btn-secondary" style="width:100%; margin-top:10px;">Edytuj</button>`;
        }
        return '';
    }
};