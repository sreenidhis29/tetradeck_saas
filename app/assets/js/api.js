const API_BASE_URL = 'http://localhost:5005/api';

const API = {
    async request(endpoint, method = 'GET', body = null) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid
                    localStorage.removeItem('token');
                    if (!window.location.pathname.includes('index.html')) {
                        window.location.href = '../../index.html';
                    }
                }
                throw new Error(data.message || 'API Error');
            }
            return data;
        } catch (error) {
            console.error('API Call Failed:', error);
            throw error;
        }
    },

    get(endpoint) { return this.request(endpoint, 'GET'); },
    post(endpoint, body) { return this.request(endpoint, 'POST', body); },
    put(endpoint, body) { return this.request(endpoint, 'PUT', body); },
    delete(endpoint) { return this.request(endpoint, 'DELETE'); },
    patch(endpoint, body) { return this.request(endpoint, 'PATCH', body); }
};

// UI Helpers
const UI = {
    showToast(message, type = 'success') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast glass-panel';
            document.body.appendChild(toast);
        }

        toast.className = `toast glass-panel ${type} show`;
        toast.innerHTML = `
            <span class="icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="msg">${message}</span>
        `;

        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    setLoading(btnId, isLoading, defaultText = 'Submit') {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner">↻</span> Processing...`;
        } else {
            btn.disabled = false;
            btn.innerHTML = defaultText;
        }
    }
};
