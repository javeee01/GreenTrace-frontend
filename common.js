// GreenTrace Common JS Module
// Shared functions: API access, layouts, toasts, modals, and settings

// Retrieve API Base URL
function getApiUrl() {
    return localStorage.getItem('greentrace_api_url') || 'https://greentrace-backend-gfu1.onrender.com';
}

// Retrieve JWT token and user info
function getAuthToken() {
    return localStorage.getItem('greentrace_token');
}

function getAuthUser() {
    const userStr = localStorage.getItem('greentrace_user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check Authentication
function checkAuth() {
    const token = getAuthToken();
    const currentPath = window.location.pathname;
    
    if (!token && !currentPath.endsWith('login.html')) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Perform authenticated/unauthenticated fetch requests
async function apiRequest(endpoint, options = {}) {
    const url = `${getApiUrl()}${endpoint}`;
    
    // Set headers
    const headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    options.headers = headers;
    
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401 || response.status === 403) {
            // Token expired or invalid
            showToast('Session expired. Please log in again.', 'error');
            localStorage.removeItem('greentrace_token');
            localStorage.removeItem('greentrace_user');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            throw new Error('Unauthorized');
        }
        
        if (response.status === 204) {
            return null; // No Content
        }
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        return data;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        throw error;
    }
}

// Toast Notifications System
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div>${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Modal open/close helpers
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Dynamic injection of layout (Sidebar & Header)
function renderCommonLayout(activePageId, pageTitle) {
    const user = getAuthUser();
    if (!user) return;
    
    const isGovernor = user.role === 'ROLE_SYSTEM_GOVERNOR';
    
    // 1. Render Settings Bar & Sidebar into body wrapper or target elements
    const body = document.body;
    
    // Check if the current page has a sidebar placeholder, if not wrap content
    let appContainer = document.getElementById('appWorkspace');
    if (!appContainer) {
        console.error('Missing #appWorkspace container in HTML');
        return;
    }
    
    // Inject Sidebar
    const sidebarHtml = `
        <aside class="app-sidebar">
            <div class="sidebar-logo">
                <i class="fa-solid fa-leaf"></i> Green<span>Trace</span>
            </div>
            
            <nav class="sidebar-menu">
                <ul>
                    <li class="sidebar-item" id="navDashGov" style="display: ${isGovernor ? 'block' : 'none'}">
                        <a href="dashboard.html" class="sidebar-link ${activePageId === 'dashboard-gov' ? 'active' : ''}">
                            <i class="fa-solid fa-chart-pie"></i> Governor Dashboard
                        </a>
                    </li>
                    <li class="sidebar-item" id="navDashAud" style="display: ${!isGovernor ? 'block' : 'none'}">
                        <a href="dashboard.html" class="sidebar-link ${activePageId === 'dashboard-aud' ? 'active' : ''}">
                            <i class="fa-solid fa-chart-line"></i> Auditor Dashboard
                        </a>
                    </li>
                    <li class="sidebar-item" style="display: ${isGovernor ? 'block' : 'none'}">
                        <a href="organizations.html" class="sidebar-link ${activePageId === 'organizations' ? 'active' : ''}">
                            <i class="fa-solid fa-building"></i> Organizations
                        </a>
                    </li>
                    <li class="sidebar-item" style="display: ${isGovernor ? 'block' : 'none'}">
                        <a href="users.html" class="sidebar-link ${activePageId === 'users' ? 'active' : ''}">
                            <i class="fa-solid fa-users"></i> User Accounts
                        </a>
                    </li>
                    <li class="sidebar-item" style="display: ${isGovernor ? 'block' : 'none'}">
                        <a href="factors.html" class="sidebar-link ${activePageId === 'factors' ? 'active' : ''}">
                            <i class="fa-solid fa-industry"></i> Emission Factors
                        </a>
                    </li>
                    <li class="sidebar-item">
                        <a href="activities.html" class="sidebar-link ${activePageId === 'activities' ? 'active' : ''}">
                            <i class="fa-solid fa-bolt"></i> Carbon Activities
                        </a>
                    </li>
                    <li class="sidebar-item">
                        <a href="reports.html" class="sidebar-link ${activePageId === 'reports' ? 'active' : ''}">
                            <i class="fa-solid fa-file-invoice"></i> Footprint Reports
                        </a>
                    </li>
                </ul>
            </nav>

            <div class="sidebar-footer">
                <div class="user-profile">
                    <div class="user-avatar" id="userAvatar">${user.name.charAt(0).toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name" id="profileName" title="${user.name}">${user.name}</div>
                        <div class="user-role" id="profileRole">${user.role === 'ROLE_SYSTEM_GOVERNOR' ? 'Governor' : 'Auditor'}</div>
                    </div>
                </div>
                <a onclick="handleLogout()" class="sidebar-link" style="color: var(--danger); cursor: pointer;">
                    <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                </a>
            </div>
        </aside>
    `;
    
    // Inject Settings bar + Header + sidebar into workspace
    const sidebarDiv = document.createElement('div');
    sidebarDiv.innerHTML = sidebarHtml;
    appContainer.insertBefore(sidebarDiv.firstElementChild, appContainer.firstChild);
    
    // Set Header
    const mainArea = document.querySelector('.app-main');
    if (mainArea) {
        // Settings bar
        const settingsBar = document.createElement('div');
        settingsBar.className = 'settings-bar';
        settingsBar.innerHTML = `
            <div>API URL: <strong id="currentApiUrl">${getApiUrl()}</strong></div>
            <button onclick="openSettingsModal()" class="api-settings-btn"><i class="fa-solid fa-gear"></i> Change</button>
        `;
        mainArea.insertBefore(settingsBar, mainArea.firstChild);
        
        // Header
        const header = document.createElement('header');
        header.className = 'app-header';
        header.innerHTML = `
            <h1 class="header-title">${pageTitle}</h1>
            <div class="header-actions">
                <span class="org-badge" id="headerOrgBadge">${user.organizationName || 'System Admin'}</span>
            </div>
        `;
        mainArea.insertBefore(header, mainArea.children[1]);
    }
    
    // Inject the Settings Modal at the end of the body if not exists
    if (!document.getElementById('modalSettings')) {
        const settingsModalHtml = `
            <div id="modalSettings" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Backend API Settings</h3>
                        <button class="btn-icon" onclick="closeModal('modalSettings')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="settingsBaseUrl">API Base URL</label>
                            <input type="url" id="settingsBaseUrl" class="form-input" value="${getApiUrl()}">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal('modalSettings')" style="width: auto;">Cancel</button>
                        <button class="btn btn-primary" onclick="saveSettings()" style="width: auto;">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = settingsModalHtml;
        body.appendChild(tempDiv.firstElementChild);
    }
}

// Settings modal controller
function openSettingsModal() {
    const input = document.getElementById('settingsBaseUrl');
    if (input) input.value = getApiUrl();
    openModal('modalSettings');
}

function saveSettings() {
    const input = document.getElementById('settingsBaseUrl');
    if (input) {
        let value = input.value.trim();
        if (value.endsWith('/')) {
            value = value.slice(0, -1);
        }
        localStorage.setItem('greentrace_api_url', value);
        const currentApiUrlEl = document.getElementById('currentApiUrl');
        if (currentApiUrlEl) currentApiUrlEl.innerText = value;
        closeModal('modalSettings');
        showToast('API URL updated successfully!', 'success');
        // Refresh page to apply
        setTimeout(() => window.location.reload(), 800);
    }
}

// Logout handler
function handleLogout() {
    localStorage.removeItem('greentrace_token');
    localStorage.removeItem('greentrace_user');
    showToast('Signed out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
}

// Resolve user details by scanning users list to find their organization
async function fetchAndSaveUserProfile(email) {
    try {
        const response = await apiRequest(`/api/users?page=0&size=100`);
        const usersList = response.content || [];
        const matchedUser = usersList.find(u => u.email === email);
        if (matchedUser) {
            const userProfile = {
                id: matchedUser.id,
                name: matchedUser.name,
                email: matchedUser.email,
                role: matchedUser.role,
                organizationId: matchedUser.organizationId || null,
                organizationName: matchedUser.organizationName || 'System Admin'
            };
            localStorage.setItem('greentrace_user', JSON.stringify(userProfile));
            return userProfile;
        }
    } catch (e) {
        console.error('Failed to resolve profile info', e);
    }
    return null;
}

// Redirect checking when loading dashboard/auth pages
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
