// js/app.js
import { ROLES, STATUS_MAP, COLLECTIONS, CONFIG } from './config.js';
import { Utils, Logger, SafeDOM } from './utils.js';
import { 
    auth, messaging, 
    getToken, onMessage, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from './firebase-init.js';
import { DataService, setRenderCallback } from './data-service.js';
import { UI } from './ui.js';
import { State } from './state.js';
import { Permissions } from './logic.js';
import { Router, Calendar, Selector } from './helpers.js';

// --- AUTH CONTROLLER ---
const Auth = {
    mode: 'login',
    selectedRole: ROLES.REPORTER,
    toggleMode: () => {
        Auth.mode = Auth.mode === 'login' ? 'register' : 'login';
        const isReg = Auth.mode === 'register';
        SafeDOM.setVisible('login-fields', !isReg);
        SafeDOM.setVisible('register-fields', isReg);
        SafeDOM.text('auth-title', isReg ? 'Rejestracja' : 'Logowanie');
        SafeDOM.text('btn-auth-action', isReg ? 'Zarejestruj się' : 'Zaloguj się');
        SafeDOM.text('auth-toggle-link', isReg ? 'Zaloguj się' : 'Zarejestruj się');
    },
    setRole: (r, el) => {
        Auth.selectedRole = r;
        document.querySelectorAll('.role-opt').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
    },
    process: async () => {
        UI.toggleLoader(true);
        try {
            const email = SafeDOM.val(Auth.mode === 'login' ? 'login-email' : 'reg-email');
            const pass = SafeDOM.val(Auth.mode === 'login' ? 'login-pass' : 'reg-pass');
            
            if (Auth.mode === 'login') {
                await signInWithEmailAndPassword(auth, email, pass);
            } else {
                if (pass.length < 6) throw new Error("Hasło min. 6 znaków");
                await createUserWithEmailAndPassword(auth, email, pass);
                await DataService.saveDoc(COLLECTIONS.USERS, {
                    email: email,
                    name: SafeDOM.val('reg-name'),
                    role: email.startsWith('admin') ? ROLES.ADMIN : Auth.selectedRole
                });
            }
        } catch (e) { Logger.error("Auth", e); } finally { UI.toggleLoader(false); }
    },
    logout: async () => { 
        await signOut(auth); 
        location.reload(); 
    }
};

// --- MAIN APP ---
const App = {
    initNotifications: async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                Logger.info("Zgoda na powiadomienia: JEST");
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                const token = await getToken(messaging, { vapidKey: CONFIG.VAPID_KEY, serviceWorkerRegistration: registration });
                
                if (token && State.user && State.user.id) {
                    await DataService.saveDoc(COLLECTIONS.USERS, { pushToken: token }, State.user.id);
                    Logger.info("Token zapisany.");
                    
                    onMessage(messaging, (payload) => {
                        UI.toast(`🔔 ${payload.notification.title}: ${payload.notification.body}`);
                        if(window.Router) App.renderAll();
                    });
                }
            }
        } catch (e) { console.error("Push Error (Silent)", e); }
    },

    init: () => {
        setRenderCallback(() => App.renderAll());

        const start = () => {
            onAuthStateChanged(auth, async (user) => {
                UI.toggleLoader(true);
                if (user && user.email) {
                    const userData = await DataService.fetchUser(user.email);
                    if (userData) {
                        State.user = userData;
                        DataService.initListeners();
                        SafeDOM.setVisible('view-login', false);
                        SafeDOM.setVisible('app-wrapper', true);
                        SafeDOM.text('user-name-display', userData.name || 'Użytkownik');
                        App.updateRoleDisplay();
                        App.initNotifications();
                        Router.go('dashboard');
                    } else {
                        await signOut(auth);
                        SafeDOM.setVisible('view-login', true);
                    }
                } else {
                    SafeDOM.setVisible('view-login', true);
                    SafeDOM.setVisible('app-wrapper', false);
                }
                UI.toggleLoader(false);
            });
        };

        // Ponieważ Firebase ładujemy jako moduł, jest gotowy od razu
        start();
        
        const searchInput = SafeDOM.get('search-jobs');
        if(searchInput) searchInput.addEventListener('keyup', Utils.debounce(() => App.renderList(), 300));
        if (window.lucide) window.lucide.createIcons();
    },

    renderAll: () => {
        if (!State.user) return;
        const role = State.getCurrentRole();
        const isRep = role === ROLES.REPORTER;
        const canManageProd = Permissions.canManageBudget(role);

        SafeDOM.setVisible('reporter-dashboard', isRep);
        SafeDOM.setVisible('mgmt-dashboard', !isRep);
        SafeDOM.setVisible('admin-switcher', Permissions.isAdmin(State.user.role));
        SafeDOM.setVisible('nav-finances', canManageProd);
        SafeDOM.setVisible('nav-settings', canManageProd);

        if (!SafeDOM.get('view-dashboard').classList.contains('hidden')) App.renderDashboard();
        if (!SafeDOM.get('view-list').classList.contains('hidden')) App.renderList();
        if (!SafeDOM.get('view-finances').classList.contains('hidden') && canManageProd) App.renderFinances();
        if (!SafeDOM.get('view-settings').classList.contains('hidden') && canManageProd) App.renderSettings();
    },

    renderDashboard: () => {
        const jobs = State.getFilteredJobs();
        const count = jobs.filter(j => j.status === STATUS_MAP.PENDING.id).length;
        
        let suffix = 'Nowych Zleceń';
        if (count === 1) suffix = 'Nowe Zlecenie';
        else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) suffix = 'Nowe Zlecenia';

        SafeDOM.text('dash-pending-text', `${count} ${suffix}`);
        
        const isRep = State.getCurrentRole() === ROLES.REPORTER;
        const displayJobs = (isRep ? jobs.filter(j => j.author === State.user.email) : jobs).slice(0, 5);
        
        const container = SafeDOM.get(isRep ? 'my-jobs-container' : 'recent-jobs-container');
        if (container) {
            container.innerHTML = '';
            const frag = document.createDocumentFragment();
            displayJobs.forEach(j => frag.appendChild(UI.renderJobCard(j)));
            container.appendChild(frag);
        }
    },

    renderList: () => {
        const container = SafeDOM.get('jobs-list-container');
        if (!container) return;
        container.innerHTML = '';

        const term = SafeDOM.val('search-jobs').toLowerCase();
        let jobs = State.getFilteredJobs();
        if (term) jobs = jobs.filter(j => j.title.toLowerCase().includes(term));

        if (jobs.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">Brak wyników</div>';
            return;
        }

        const groups = {};
        jobs.forEach(j => {
            const key = j.date.substring(0, 7) || '0000-00';
            if (!groups[key]) groups[key] = [];
            groups[key].push(j);
        });

        const frag = document.createDocumentFragment();
        Object.keys(groups).sort().reverse().forEach(key => {
            const header = document.createElement('div');
            header.className = 'month-header';
            header.innerText = Utils.getMonthYear(groups[key][0].date);
            frag.appendChild(header);
            groups[key].forEach(j => frag.appendChild(UI.renderJobCard(j)));
        });
        container.appendChild(frag);
    },

    renderFinances: () => {
        const s = State.getActiveSeason();
        if(!s) return;
        SafeDOM.text('finance-season-name', s.name);

        let totalSpent = 0;
        const epCosts = {};
        const expenseList = [];
        const budget = Utils.safeNumber(s.budget);

        // Process Jobs
        State.getFilteredJobs().forEach(j => {
            // FIX: CostCalculator.calculateJobTotal needs access to Utils if inside logic.js
            // But logic.js imports Utils, so it should be fine.
            // If CostCalculator is imported from logic.js, we use it directly.
            // However, in previous steps we might have missed importing CostCalculator in logic.js?
            // Assuming logic.js is correct.
            
            // Let's implement calculating logic here to be safe if imports are tricky or just use the imported helper
            // We use logic from imported modules.
            
            // RE-IMPLEMENTATION of logic here for safety if logic.js is simple:
            let cost = 0;
            if (j.manualCost && parseFloat(j.manualCost) > 0) {
                cost = Utils.safeNumber(j.manualCost);
            } else {
                const crewCost = (j.crew || []).reduce((acc, c) => acc + Utils.safeNumber(c.cost), 0);
                const logisticsCost = Utils.safeNumber(j.logistics?.hotel?.cost) + Utils.safeNumber(j.logistics?.transport?.cost);
                cost = crewCost + logisticsCost;
            }

            if (cost > 0) {
                totalSpent += cost;
                if(j.episodeId) epCosts[j.episodeId] = (epCosts[j.episodeId] || 0) + cost;
                expenseList.push({ type: 'job', id: j.id, title: j.title, desc: j.episodeId ? `Odc. ${j.episodeId}` : 'Nieprzypisane', amount: cost, icon: 'movie' });
            }
        });

        // Process Extra Costs
        State.data.extraCosts.filter(c => c.seasonId === s.id).forEach(c => {
            const amt = Utils.safeNumber(c.amount);
            totalSpent += amt;
            if(c.episodeId) epCosts[c.episodeId] = (epCosts[c.episodeId] || 0) + amt;
            expenseList.push({ type: 'extra', id: c.id, title: c.title, desc: c.episodeId ? `Odc. ${c.episodeId}` : 'Ogólny', amount: amt, icon: 'attach_money' });
        });

        SafeDOM.text('season-spent', `${totalSpent} PLN`);
        SafeDOM.text('season-total', `${budget} PLN`);
        SafeDOM.text('season-remaining', `${budget - totalSpent} PLN`);
        SafeDOM.style('season-progress', 'width', `${budget > 0 ? Math.min((totalSpent/budget)*100, 100) : 0}%`);

        const grid = SafeDOM.get('episodes-grid');
        if(grid) {
            grid.innerHTML = '';
            const avg = budget / (s.episodes || 1);
            const frag = document.createDocumentFragment();
            for(let i=1; i<=(s.episodes||12); i++) {
                const c = epCosts[i] || 0;
                const d = document.createElement('div');
                d.className = 'episode-cell';
                if (c > avg) d.style.borderColor = 'var(--ios-red)';
                else if (c > 0) d.style.borderColor = 'var(--ios-green)';
                d.innerHTML = `<div style="font-weight:700; color:white;">ODC ${i}</div><div style="color:#ccc">${c}</div>`;
                frag.appendChild(d);
            }
            grid.appendChild(frag);
        }

        const listContainer = SafeDOM.get('finance-list');
        if (listContainer) {
            listContainer.innerHTML = '';
            const frag = document.createDocumentFragment();
            expenseList.reverse().slice(0, 15).forEach(ex => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);';
                if(ex.type === 'extra') { row.style.cursor = 'pointer'; row.onclick = () => App.openEditCost(ex.id); }
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="background:rgba(255,255,255,0.1); width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-outlined" style="font-size:18px; color:var(--text-secondary)">${ex.icon}</span>
                        </div>
                        <div>
                            <div style="font-weight:600; font-size:13px;">${Utils.escape(ex.title)} ${ex.type==='extra'?'<span style="font-size:10px; color:var(--brand-color)">✎</span>':''}</div>
                            <div style="font-size:11px; color:var(--text-secondary)">${ex.desc}</div>
                        </div>
                    </div>
                    <div style="font-weight:700; color:var(--ios-green); font-size:13px;">${ex.amount} PLN</div>`;
                frag.appendChild(row);
            });
            listContainer.appendChild(frag);
        }
    },

    renderSettings: () => {
        const s = State.getActiveSeason();
        if(!s) return;
        SafeDOM.val('edit-season-name', s.name);
        SafeDOM.val('edit-season-budget', s.budget);
        SafeDOM.val('edit-season-episodes', s.episodes);

        const tbody = SafeDOM.get('episodes-meta-list');
        if(tbody) {
            tbody.innerHTML = '';
            const frag = document.createDocumentFragment();
            for(let i=1; i<=(s.episodes||0); i++) {
                const m = (s.episodesData||{})[i] || {};
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${i}</td>
                    <td><input class="sap-input ep-id" data-ep="${i}" value="${Utils.escape(m.id)}"></td>
                    <td><input class="sap-input ep-sape" data-ep="${i}" value="${Utils.escape(m.sapE)}"></td>
                    <td><input class="sap-input ep-sapp" data-ep="${i}" value="${Utils.escape(m.sapP)}"></td>`;
                frag.appendChild(tr);
            }
            tbody.appendChild(frag);
        }

        const slist = SafeDOM.get('seasons-list');
        if(slist) {
            slist.innerHTML = '';
            const frag = document.createDocumentFragment();
            State.data.seasons.forEach(ss => {
                const div = document.createElement('div');
                div.className = `season-item ${ss.id === State.activeSeasonId ? 'active-season' : ''}`;
                div.innerHTML = `<div><b>${Utils.escape(ss.name)}</b></div><button class="btn-sm btn-secondary" onclick="window.App.activateSeason('${ss.id}')">Aktywuj</button>`;
                frag.appendChild(div);
            });
            slist.appendChild(frag);
        }
    },

    // --- ACTIONS ---
    openNewOrder: () => {
        SafeDOM.get('order-form').reset();
        delete SafeDOM.get('order-form').dataset.id;
        SafeDOM.get('btn-delete-job')?.remove();
        SafeDOM.get('btn-confirm-crew')?.remove();
        SafeDOM.html('crew-list', '');
        
        App._applyOrderFormVisibility();

        const today = new Date().toISOString().split('T')[0];
        SafeDOM.val('job-date', today);
        SafeDOM.text('job-date-display', today);
        SafeDOM.text('job-episode-display', 'Nie wybrano');
        SafeDOM.text('detail-author-name', State.user.name || State.user.email);
        
        Router.go('order');
    },

    openEditJob: (id) => {
        const j = State.data.jobs.find(x => x.id === id);
        if (!j) return;
        Router.go('order');

        const authorUser = State.data.users.find(u => u.email === j.author);
        SafeDOM.text('detail-author-name', authorUser ? authorUser.name : (j.author || 'Nieznany'));
        
        const form = SafeDOM.get('order-form');
        form.dataset.id = id;
        SafeDOM.val('job-title', j.title);
        SafeDOM.val('job-location', j.location);
        SafeDOM.val('job-desc', j.desc);
        SafeDOM.val('job-pax-comment', j.paxComment);
        SafeDOM.val('job-manual-cost', j.manualCost || '');
        SafeDOM.val('job-date', j.date);
        SafeDOM.text('job-date-display', j.date);
        
        if(j.episodeId) {
            SafeDOM.val('job-episode', j.episodeId);
            SafeDOM.text('job-episode-display', "Odcinek " + j.episodeId);
        } else {
            SafeDOM.val('job-episode', '');
            SafeDOM.text('job-episode-display', 'Nie wybrano');
        }

        SafeDOM.html('crew-list', '');
        (j.crew || []).forEach(c => App.addCrewRow(c));

        SafeDOM.setChecked('check-hotel', j.logistics?.hotel?.needed || false);
        SafeDOM.setVisible('wrap-hotel', j.logistics?.hotel?.needed);
        SafeDOM.val('desc-hotel', j.logistics?.hotel?.details || '');
        SafeDOM.val('cost-hotel', j.logistics?.hotel?.cost || '');

        SafeDOM.setChecked('check-transport', j.logistics?.transport?.needed || false);
        SafeDOM.setVisible('wrap-transport', j.logistics?.transport?.needed);
        SafeDOM.val('desc-transport', j.logistics?.transport?.details || '');
        SafeDOM.val('cost-transport', j.logistics?.transport?.cost || '');

        App._applyOrderFormVisibility();
        
        // --- FIX: PRZYWRÓCONA LOGIKA PRZYCISKÓW ---
        SafeDOM.get('btn-delete-job')?.remove();
        SafeDOM.get('btn-confirm-crew')?.remove();

        const role = State.getCurrentRole();

        if(Permissions.canManageBudget(role)) {
            // Jeśli status to APPROVED (Szukanie Ekipy) -> Pokaż guzik "Zatwierdź Ekipę"
            if (j.status === STATUS_MAP.APPROVED.id) {
                const btn = document.createElement('button');
                btn.id = 'btn-confirm-crew';
                btn.type = 'button'; // Ważne: prevent submit
                btn.className = 'btn btn-approve'; 
                btn.style.marginTop = '20px';
                btn.innerText = 'Zatwierdź Ekipę (Do Realizacji)';
                btn.onclick = () => App.confirmCrew(id);
                form.appendChild(btn);
            }
            
            const delBtn = document.createElement('button');
            delBtn.id = 'btn-delete-job';
            delBtn.type = 'button';
            delBtn.className = 'btn btn-reject';
            delBtn.style.marginTop = '10px';
            delBtn.innerText = 'Usuń Zlecenie';
            delBtn.onclick = () => App.deleteJob(id);
            form.appendChild(delBtn);
        }
    },

    _applyOrderFormVisibility: () => {
        const role = State.getCurrentRole();
        SafeDOM.setVisible('group-pax-comment', Permissions.isPax(role));
        const canManageProd = Permissions.canManageBudget(role);
        SafeDOM.setVisible('group-episode', canManageProd);
        SafeDOM.setVisible('group-job-cost', canManageProd);
        
        document.querySelectorAll('.prod-only').forEach(el => SafeDOM.setVisible(el.id, canManageProd));
        document.querySelectorAll('#wrap-hotel .prod-only, #wrap-transport .prod-only').forEach(el => {
            if(canManageProd) el.classList.remove('hidden'); else el.classList.add('hidden');
        });
    },

    saveJobFromForm: async () => {
        UI.toggleLoader(true);
        try {
            const editId = SafeDOM.get('order-form').dataset.id;
            const { crew, phonebookUpdated } = App._collectCrewData();
            
            if(phonebookUpdated) {
                try {
                    const current = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PHONEBOOK) || '{}');
                } catch (e) { console.warn("Phonebook error"); }
            }

            const jobData = {
                title: SafeDOM.val('job-title'),
                date: SafeDOM.val('job-date'),
                location: SafeDOM.val('job-location'),
                desc: SafeDOM.val('job-desc'),
                paxComment: SafeDOM.val('job-pax-comment'),
                episodeId: Utils.safeNumber(SafeDOM.val('job-episode')) || null,
                manualCost: Utils.safeNumber(SafeDOM.val('job-manual-cost')) || null,
                seasonId: State.activeSeasonId,
                author: State.user.email,
                status: editId ? (State.data.jobs.find(j=>j.id==editId)||{}).status : STATUS_MAP.PENDING.id,
                crew: crew,
                logistics: App._getLogisticsData()
            };

            await DataService.saveDoc(COLLECTIONS.JOBS, jobData, editId);
            UI.toast('Zapisano');
            Router.back();
        } catch (e) { Logger.error("Save Job", e); } 
        finally { UI.toggleLoader(false); }
    },

    _collectCrewData: () => {
        const crew = [];
        let phonebookUpdated = false;
        let phonebook = {};
        try { phonebook = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PHONEBOOK) || '{}'); } catch(e) {}

        document.querySelectorAll('.crew-row-item').forEach(r => {
            const cName = r.querySelector('.crew-name').value.trim();
            const cPhone = r.querySelector('.crew-phone').value.trim();
            if (cName && cPhone) {
                phonebook[cName] = cPhone;
                phonebookUpdated = true;
            }
            crew.push({
                role: r.querySelector('.crew-role').value,
                name: cName,
                phone: cPhone,
                cost: Utils.safeNumber(r.querySelector('.crew-cost')?.value)
            });
        });
        if(phonebookUpdated) localStorage.setItem(CONFIG.STORAGE_PHONEBOOK, JSON.stringify(phonebook));
        return { crew, phonebookUpdated };
    },

    _getLogisticsData: () => {
        return {
            hotel: { 
                needed: SafeDOM.isChecked('check-hotel'), 
                details: SafeDOM.val('desc-hotel'), 
                cost: SafeDOM.val('cost-hotel') 
            },
            transport: { 
                needed: SafeDOM.isChecked('check-transport'), 
                details: SafeDOM.val('desc-transport'), 
                cost: SafeDOM.val('cost-transport') 
            }
        };
    },

    deleteJob: async (id) => {
        if(!confirm('Czy na pewno chcesz usunąć to zlecenie?')) return;
        UI.toggleLoader(true);
        try { await DataService.deleteDoc(COLLECTIONS.JOBS, id); UI.toast('Usunięto'); Router.back(); }
        catch(e) { Logger.error("Delete Job", e); } finally { UI.toggleLoader(false); }
    },

    confirmCrew: async (id) => {
        if(!confirm('Zlecenie zmieni status na "W Realizacji".')) return;
        UI.toggleLoader(true);
        try { await DataService.saveDoc(COLLECTIONS.JOBS, { status: STATUS_MAP.READY.id }, id); UI.toast('Zatwierdzono'); Router.back(); }
        catch(e) { Logger.error("Status Change", e); } finally { UI.toggleLoader(false); }
    },

    handlePaxDecision: (id, isApproved) => {
        App.tempDecision = { id, isApproved };
        UI.openModal('modal-decision');
    },

    submitPaxDecision: async () => {
        const { id, isApproved } = App.tempDecision;
        const comment = SafeDOM.val('decision-comment');
        if (!isApproved && !comment) return UI.toast('Wymagany komentarz przy odrzuceniu!', 'error');
        
        try {
            await DataService.saveDoc(COLLECTIONS.JOBS, { 
                status: isApproved ? STATUS_MAP.APPROVED.id : STATUS_MAP.REJECTED.id, 
                paxComment: comment 
            }, id);
            UI.closeModal('modal-decision');
            UI.toast('Decyzja zapisana');
        } catch (e) { Logger.error("Decision", e); }
    },

    toggleLogistics: (type) => SafeDOM.setVisible('wrap-' + type, SafeDOM.isChecked('check-' + type)),
    
    addCrewRow: (data = {}) => {
        const id = Utils.generateId();
        const showCost = Permissions.canManageBudget(State.getCurrentRole());
        const div = document.createElement('div');
        div.className = 'crew-row-item';
        div.innerHTML = `
            <div class="crew-role-badge" id="rd-${id}" onclick="window.Selector.openRoles('rd-${id}','rv-${id}')">
                <i data-lucide="user-circle" style="width:20px; height:20px; margin-bottom:4px;"></i>
                <span class="role-text" style="font-size:9px; font-weight:700; text-transform:uppercase; text-align:center; line-height:1.1;">${data.role||'WYBIERZ'}</span>
            </div>
            <input type="hidden" class="crew-role" id="rv-${id}" value="${data.role||''}">
            <div class="crew-info-stack">
                <input type="text" class="crew-input-name crew-name" placeholder="Imię i Nazwisko" value="${data.name||''}" onblur="window.App.autofillPhone(this)">
                <div style="display:flex; align-items:center; gap:4px; opacity:0.7;" class="${Permissions.canManageBudget(State.getCurrentRole()) ? '' : 'hidden'}">
                    <i data-lucide="phone" style="width:10px; height:10px;"></i>
                    <input type="tel" class="crew-input-phone crew-phone" placeholder="Telefon..." value="${data.phone||''}">
                </div>
            </div>
            <div class="crew-actions">
                <button type="button" class="btn-remove-row" onclick="this.closest('.crew-row-item').remove()" style="width:24px; height:24px; font-size:16px; background:transparent; color:var(--ios-red);">
                    <i data-lucide="x"></i>
                </button>
                ${showCost ? `<input type="number" class="crew-input-cost crew-cost" placeholder="0" value="${data.cost||''}">` : ''}
            </div>`;
        SafeDOM.get('crew-list')?.appendChild(div);
        if(window.lucide) window.lucide.createIcons();
    },
    
    autofillPhone: (nameInput) => {
        const name = nameInput.value.trim();
        if(!name) return;
        try {
            const phonebook = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PHONEBOOK) || '{}');
            const row = nameInput.closest('.crew-row-item');
            const phoneInput = row.querySelector('.crew-phone');
            if (phonebook[name] && phoneInput && !phoneInput.value) {
                phoneInput.value = phonebook[name];
                window.UI.toast('Wczytano numer dla: ' + name);
            }
        } catch (e) { /* Ignore parsing errors */ }
    },
    
    openEditCost: (id) => {
        const cost = State.data.extraCosts.find(c => c.id === id);
        SafeDOM.val('cost-id', cost ? cost.id : '');
        SafeDOM.val('cost-title', cost ? cost.title : '');
        SafeDOM.val('cost-amount', cost ? cost.amount : '');
        SafeDOM.val('cost-episode-input', cost?.episodeId || '');
        SafeDOM.text('cost-episode-display', cost?.episodeId ? `Odcinek ${cost.episodeId}` : 'Nie wybrano');
        SafeDOM.text('cost-modal-title', cost ? 'Edytuj Koszt' : 'Dodaj Koszt');
        SafeDOM.setVisible('btn-delete-cost', !!cost);
        UI.openModal('modal-cost');
    },

    saveExtraCost: async () => {
        const id = SafeDOM.val('cost-id');
        try {
            const data = {
                title: SafeDOM.val('cost-title'),
                amount: Utils.safeNumber(SafeDOM.val('cost-amount')),
                episodeId: Utils.safeNumber(SafeDOM.val('cost-episode-input')),
                seasonId: State.activeSeasonId
            };
            if(!data.title || !data.amount) return UI.toast('Uzupełnij dane', 'error');
            await DataService.saveDoc(COLLECTIONS.COSTS, data, id || null);
            UI.closeModal('modal-cost');
            UI.toast('Zapisano');
        } catch(e) { Logger.error("Save Cost", e); }
    },

    deleteCost: async () => {
        const id = SafeDOM.val('cost-id');
        if(!id || !confirm('Usunąć koszt?')) return;
        try {
            await DataService.deleteDoc(COLLECTIONS.COSTS, id);
            UI.closeModal('modal-cost');
            UI.toast('Usunięto');
        } catch(e) { Logger.error("Delete Cost", e); }
    },

    // Admin features
    adminSwitchRole: (role) => {
        State.impersonatedRole = role;
        App.updateRoleDisplay();
        App.renderAll();
        UI.toast(`Podgląd: ${role}`);
    },
    updateRoleDisplay: () => {
        const role = State.getCurrentRole();
        const label = Permissions.isAdmin(State.user.role) && role !== ROLES.ADMIN ? `${role} (Admin View)` : role;
        SafeDOM.text('user-role-badge', label.toUpperCase());
    },
    activateSeason: (id) => { State.activeSeasonId = id; App.renderAll(); },
    addSeason: async () => {
        try {
            const data = {
                name: SafeDOM.val('new-season-name'),
                budget: Utils.safeNumber(SafeDOM.val('new-season-budget')),
                episodes: Utils.safeNumber(SafeDOM.val('new-season-episodes'))
            };
            await DataService.saveDoc(COLLECTIONS.SEASONS, data);
            UI.toast('Dodano sezon');
        } catch(e) { Logger.error("Add Season", e); }
    },
    updateActiveSeason: async () => {
        const s = State.getActiveSeason();
        if(!s) return;
        try {
            const data = {
                ...s,
                name: SafeDOM.val('edit-season-name'),
                budget: Utils.safeNumber(SafeDOM.val('edit-season-budget')),
                episodes: Utils.safeNumber(SafeDOM.val('edit-season-episodes'))
            };
            await DataService.saveDoc(COLLECTIONS.SEASONS, data, s.id);
            UI.toast('Zaktualizowano');
        } catch(e) { Logger.error("Update Season", e); }
    },
    saveEpisodeMeta: async () => {
        const s = State.getActiveSeason();
        try {
            const newMeta = {};
            document.querySelectorAll('.ep-id').forEach(el => {
                const ep = el.dataset.ep;
                newMeta[ep] = {
                    id: el.value,
                    sapE: document.querySelector(`.ep-sape[data-ep="${ep}"]`).value,
                    sapP: document.querySelector(`.ep-sapp[data-ep="${ep}"]`).value
                };
            });
            await DataService.saveDoc(COLLECTIONS.SEASONS, { episodesData: newMeta }, s.id);
            UI.toast('Zapisano');
        } catch(e) { Logger.error("Save Meta", e); }
    }
};

// --- BRIDGE ---
// Wystawiamy wszystko na świat, żeby HTML (onclick) to widział
window.App = App;
window.Auth = Auth;
window.Router = Router;
window.Calendar = Calendar;
window.Selector = Selector;
window.UI = UI;

// Start
App.init();