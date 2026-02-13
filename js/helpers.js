// js/helpers.js
import { SafeDOM, Utils } from './utils.js';
import { UI } from './ui.js';
import { State } from './state.js';
import { Permissions } from './logic.js';

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
        if (window.App) window.App.renderAll();
    },
    back: () => Router.go(Router.history.length > 0 ? Router.history.pop() : 'dashboard', true)
};

export const Calendar = {
    currentDate: new Date(),

    open: () => {
        Calendar.currentDate = new Date();
        Calendar.render(Calendar.currentDate);
        UI.openModal('modal-calendar');
    },

    prevMonth: () => {
        Calendar.currentDate.setMonth(Calendar.currentDate.getMonth() - 1);
        Calendar.render(Calendar.currentDate);
    },

    nextMonth: () => {
        Calendar.currentDate.setMonth(Calendar.currentDate.getMonth() + 1);
        Calendar.render(Calendar.currentDate);
    },

    render: (date) => {
        const container = SafeDOM.get('cal-days-container');
        if (!container) return;
        container.innerHTML = '';

        const year = date.getFullYear();
        const month = date.getMonth();

        SafeDOM.text('cal-month-year', new Date(year, month, 1).toLocaleString('pl-PL', { month: 'long', year: 'numeric' }));

        // Ile dni w miesiącu
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Jaki dzień tygodnia wypada 1-szy (0=Nd, 1=Pn... -> przesuwamy na Pn=0)
        let firstDayOfWeek = new Date(year, month, 1).getDay();
        firstDayOfWeek = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1; // Pn=0, Wt=1...Nd=6

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        const frag = document.createDocumentFragment();

        // Puste komórki przed 1-szym dniem
        for (let i = 0; i < firstDayOfWeek; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day';
            empty.style.opacity = '0';
            empty.style.pointerEvents = 'none';
            frag.appendChild(empty);
        }

        // Dni miesiąca
        for (let i = 1; i <= daysInMonth; i++) {
            const d = document.createElement('div');
            d.className = 'cal-day';
            d.innerText = i;

            if (isCurrentMonth && i === today.getDate()) {
                d.style.background = 'var(--brand-color)';
                d.style.color = 'white';
                d.style.fontWeight = '700';
            }

            d.onclick = () => {
                const str = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
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

        const season = State.getActiveSeason();
        const count = (season && season.episodes) ? season.episodes : 12;

        const startNum = season ? Utils.getSeasonStart(season.name) : 1;

        const frag = document.createDocumentFragment();

        for (let i = 0; i < count; i++) {
            const currentNum = startNum + i;

            const item = document.createElement('div');
            item.className = 'selector-item';
            item.innerText = `Odcinek ${currentNum}`;
            item.onclick = () => {
                SafeDOM.val(inputId, currentNum);
                const displayEl = SafeDOM.get(displayId);
                if (displayEl) displayEl.innerText = `Odcinek ${currentNum}`;
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
                if (textSpan) textSpan.innerText = role;
                UI.closeModal('modal-selector');
            };
            frag.appendChild(item);
        });
        list.appendChild(frag);
        UI.openModal('modal-selector');
    }
};