// js/helpers.js
import { SafeDOM, Utils } from './utils.js';
import { UI } from './ui.js';
import { State } from './state.js'; // Potrzebne dla Selectora (ilość odcinków)

export const Router = {
    history: [],
    go: (viewId, isBack = false) => {
        const current = document.querySelector('.app-container:not(.hidden)');
        if (current && !isBack && current.id !== 'view-login') Router.history.push(current.id.replace('view-', ''));
        
        document.querySelectorAll('.app-container').forEach(el => el.classList.add('hidden'));
        SafeDOM.setVisible('view-' + viewId, true);
        
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        SafeDOM.get('nav-' + viewId)?.classList.add('active');
        
        if (viewId === 'dashboard') Router.history = [];
        // Router zakłada, że window.App jest dostępne globalnie (bo App.js ładuje się na końcu)
        if (window.App) window.App.renderAll();
    },
    back: () => Router.go(Router.history.length > 0 ? Router.history.pop() : 'dashboard', true)
};

export const Calendar = {
    open: () => { UI.openModal('modal-calendar'); Calendar.render(new Date()); },
    render: (date) => {
        const container = SafeDOM.get('cal-days-container');
        if(!container) return;
        container.innerHTML = '';
        SafeDOM.text('cal-month-year', Utils.getMonthYear(date.toISOString()));
        const frag = document.createDocumentFragment();
        for(let i=1; i<=30; i++) {
            const d = document.createElement('div');
            d.className = 'cal-day';
            d.innerText = i;
            d.onclick = () => {
                const str = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${i.toString().padStart(2,'0')}`;
                SafeDOM.val('job-date', str);
                SafeDOM.text('job-date-display', str);
                UI.closeModal('modal-calendar');
            };
            frag.appendChild(d);
        }
        container.appendChild(frag);
    }
};

export const Selector = {
    openEpisodes: (inputId, displayId) => {
        const list = SafeDOM.get('selector-list');
        list.innerHTML = '';
        SafeDOM.text('selector-title', "Wybierz Odcinek");
        const count = (State.getActiveSeason() || {}).episodes || 12;
        const frag = document.createDocumentFragment();
        for(let i=1; i<=count; i++) {
            const item = document.createElement('div');
            item.className = 'selector-item';
            item.innerText = `Odcinek ${i}`;
            item.onclick = () => {
                SafeDOM.val(inputId, i);
                const displayEl = SafeDOM.get(displayId);
                if(displayEl) displayEl.innerText = `Odcinek ${i}`;
                UI.closeModal('modal-selector');
            };
            frag.appendChild(item);
        }
        list.appendChild(frag);
        UI.openModal('modal-selector');
    },
    openRoles: (displayId, valId) => {
        const list = SafeDOM.get('selector-list');
        list.innerHTML = '';
        SafeDOM.text('selector-title', "Wybierz Rolę");
        const roles = ['Operator', 'Dźwiękowiec', 'Montażysta', 'Kierownik Planu', 'Oświetlacz'];
        const frag = document.createDocumentFragment();
        roles.forEach(role => {
            const item = document.createElement('div');
            item.className = 'selector-item';
            item.innerText = role;
            item.onclick = () => {
                SafeDOM.val(valId, role);
                const displayEl = SafeDOM.get(displayId);
                const textSpan = displayEl.querySelector('.role-text') || displayEl.querySelector('span');
                if(textSpan) textSpan.innerText = role;
                UI.closeModal('modal-selector');
            };
            frag.appendChild(item);
        });
        list.appendChild(frag);
        UI.openModal('modal-selector');
    }
};