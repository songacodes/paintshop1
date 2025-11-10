// --- Data Management System (API-based) ---

const API_BASE = 'http://localhost:3000/api';

function getHeaders() {
    const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    
    const role = loggedInUser?.role || '';
    
    return {
        'Content-Type': 'application/json',
        'x-user-role': role.trim() 
    };
}

// Add debug function (kept for general debugging if needed)
function getCurrentUser() {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    console.log('Current user from storage (debug):', {
        user,
        role: user?.role,
        roleType: typeof user?.role
    });
    return user;
}

const DataAPI = {
    // --- AUTHENTICATION ---
    loginUser: async (username, password) => {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('[DataAPI.loginUser] API error:', res.status, errorData);
            throw new Error(errorData.error || 'Login failed');
        }
        const result = await res.json();
        return result.user; 
    },

    // --- LOGIN ACTIVITY LOGS (NEW SECTION) ---
    logLoginAttempt: async (logData) => {
        try {
            const res = await fetch(`${API_BASE}/login-logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logData)
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Failed to parse log error' }));
                console.error('[DataAPI.logLoginAttempt] Failed to log login attempt:', res.status, errorData);
            }
            return res.ok;
        } catch (error) {
            console.error('[DataAPI.logLoginAttempt] Error logging login attempt:', error);
            return false;
        }
    },

    getLoginLogs: async () => {
        const res = await fetch(`${API_BASE}/login-logs`, {
            headers: getHeaders(), // Requires authentication to view logs
            cache: 'no-store'
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error getting login logs:', res.status, error);
            throw new Error(error.error || 'Failed to fetch login logs');
        }
        return await res.json();
    },

    // --- USERS ---
    getUsers: async () => {
        const res = await fetch(`${API_BASE}/users`, { 
            headers: getHeaders(),
            cache: 'no-store' 
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error getting users:', res.status, error);
            throw new Error(error.error || 'Failed to fetch users');
        }
        return await res.json();
    },
    
    saveUser: async (username, userData) => {
        let userExists = false;
        try {
            const allUsers = await DataAPI.getUsers(); 
            userExists = !!allUsers[username];
        } catch (error) {
            console.warn("Could not fetch users to determine existence, assuming new user for POST (this might be fine or indicate a larger issue):", error);
        }

        let url = `${API_BASE}/users`;
        let method = 'POST';
        let payload = { ...userData };

        if (userExists) {
            url = `${API_BASE}/users/${username}`;
            method = 'PUT';
            // For update, do NOT include username in payload
            if ('username' in payload) delete payload.username;
        } else {
            // For create, include username in payload
            payload.username = username;
        }
        
        console.log(`[DataAPI.saveUser] Sending ${method} request to ${url} for user: ${username}`);
        console.log('[DataAPI.saveUser] Payload:', payload);

        const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        const res = await fetch(url, {
            method: method,
            headers: {
                ...getHeaders(),
                'x-username': loggedInUser?.username || ''
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error(`[DataAPI.saveUser] API error (${res.status}):`, errorData);
            throw new Error(errorData.error || `Failed to ${method === 'POST' ? 'create' : 'update'} user`);
        }
        return await res.json();
    },

    deleteUser: async (username) => {
        const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        const res = await fetch(`${API_BASE}/users/${username}`, {
            method: 'DELETE',
            headers: {
                ...getHeaders(),
                'x-username': loggedInUser?.username || ''
            }
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error deleting user:', res.status, error);
            throw new Error(error.error || 'Failed to delete user');
        }
        return await res.json();
    },

    // --- BRANCHES ---
    getBranches: async () => {
        const res = await fetch(`${API_BASE}/branches`, { 
            headers: getHeaders(),
            cache: 'no-store' 
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error getting branches:', res.status, error);
            throw new Error(error.error || 'Failed to fetch branches');
        }
        return await res.json();
    },
    
    saveBranch: async (branchId, branchData) => {
        const res = await fetch(`${API_BASE}/branches/${branchId}`, { 
            method: 'PUT', 
            headers: getHeaders(),
            body: JSON.stringify(branchData)
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error saving branch:', res.status, error);
            throw new Error(error.error || 'Failed to save branch');
        }
        return await res.json();
    },
    deleteBranch: async (branchId) => {
        const res = await fetch(`${API_BASE}/branches/${branchId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error deleting branch:', res.status, error);
            throw new Error(error.error || 'Failed to delete branch');
        }
        return await res.json();
    },

    // --- CLIENTS ---
    getClients: async () => {
        const res = await fetch(`${API_BASE}/clients`, { 
            headers: getHeaders(),
            cache: 'no-store' 
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error getting clients:', res.status, error);
            throw new Error(error.error || 'Failed to fetch clients');
        }
        return await res.json();
    },
    saveClient: async (branchId, clientData) => {
        // clientData here will either be { name, phoneNumber } for single add,
        // or { clients: [...] } for bulk import.
        let payload;
        if (clientData.name && clientData.phoneNumber) { // This is a single client
            payload = {
                branchId: branchId,
                client: { // Nest the client object as per server expectation
                    name: clientData.name, 
                    phoneNumber: clientData.phoneNumber
                } 
            };
        } else if (Array.isArray(clientData.clients)) { // This is a bulk import or replace
            payload = {
                branchId: branchId,
                clients: clientData.clients,
                ...(clientData.replaceAll ? { replaceAll: true } : {})
            };
        } else {
            throw new Error("Invalid client data format provided to DataAPI.saveClient");
        }

        const res = await fetch(`${API_BASE}/clients`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error saving client:', res.status, error);
            throw new Error(error.error || 'Failed to save client');
        }
        return await res.json();
    },
    deleteClient: async (branchId, index) => {
        const url = `${API_BASE}/clients/${branchId}/${index}`; 
        const res = await fetch(url, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error deleting client:', res.status, error);
            throw new Error(error.error || 'Failed to delete client');
        }
        return await res.json();
    },

    // --- PURCHASES ---
    getPurchases: async () => {
        const res = await fetch(`${API_BASE}/purchases`, { 
            headers: getHeaders(),
            cache: 'no-store' 
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error getting purchases:', res.status, error);
            throw new Error(error.error || 'Failed to fetch purchases');
        }
        return await res.json();
    },
    savePurchase: async (purchase) => {
        const res = await fetch(`${API_BASE}/purchases`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(purchase)
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error saving purchase:', res.status, error);
            throw new Error(error.error || 'Failed to save purchase');
        }
        return await res.json();
    },
    deletePurchase: async (purchaseId) => {
        const res = await fetch(`${API_BASE}/purchases/${purchaseId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error('API Error deleting purchase:', res.status, error);
            throw new Error(error.error || 'Failed to delete purchase');
        }
        return await res.json();
    }
};
