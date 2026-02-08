// js/config.js
export const ROLES = {
    REPORTER: 'reporter',
    PAX: 'pax',
    PRODUCTION: 'production',
    PRODUCER: 'producer',
    ADMIN: 'admin'
};

export const STATUS_MAP = {
    PENDING: { id: 'pending_approval', label: 'Czeka na PAX', css: 'status-pending_approval' },
    APPROVED: { id: 'approved_concept', label: 'Szukanie Ekipy', css: 'status-approved_concept' },
    READY: { id: 'production_ready', label: 'W Realizacji', css: 'status-production_ready' },
    REJECTED: { id: 'rejected', label: 'Odrzucone', css: 'status-rejected' }
};

export const COLLECTIONS = {
    USERS: 'users',
    JOBS: 'jobs',
    COSTS: 'extraCosts',
    SEASONS: 'seasons'
    GLOBAL_BUDGETS: 'globalBudgets' // NOWE: Kolekcja dla Magdy
};

export const CONFIG = {
    // Twój klucz publiczny (Public Key)
    VAPID_KEY: "BMm_qK8s5vJg9tZ4e1Xn3pL7o_uY6rW2iQ0aS8dF9hG5jK1lZ4xC3vB2nN7mM9", 
    STORAGE_PHONEBOOK: 'sr_phonebook'
};

