// js/utils.js
import { SEASON_STARTS } from './config.js'; // <--- Pamiętaj o imporcie na górze!

export const Utils = {
    escape: (str) => {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    },
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    formatDate: (dateStr) => {
        if (!dateStr) return 'Brak daty';
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('pl-PL');
    },
    getMonthYear: (dateStr) => {
        if (!dateStr) return 'Inne';
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? 'Inne' : date.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });
    },
    safeNumber: (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    },
    getSeasonStart: (seasonName) => {
        // Jeśli mamy wpis w configu, użyj go. Jeśli nie, zacznij od 1.
        return SEASON_STARTS[seasonName] || 1;
    },
    debounce: (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
};

export const Logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg, e) => {
        console.error(`[ERROR] ${msg}`, e);
        if(window.UI && window.UI.toast) window.UI.toast(`Błąd: ${msg}`, 'error');
    }
};

export const SafeDOM = {
    get: (id) => document.getElementById(id),
    val: (id, v) => {
        const el = document.getElementById(id);
        if (!el) return '';
        if (v !== undefined) el.value = v;
        return el.value;
    },
    text: (id, t) => { const el = document.getElementById(id); if (el) el.innerText = t; },
    html: (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; },
    setVisible: (id, visible) => { 
        const el = document.getElementById(id); 
        if (el) el.classList.toggle('hidden', !visible); 
    },
    isChecked: (id) => { const el = document.getElementById(id); return el ? el.checked : false; },
    setChecked: (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; },
    style: (id, p, v) => { const el = document.getElementById(id); if (el) el.style[p] = v; }
};