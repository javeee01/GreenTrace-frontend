// GreenTrace Login Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // If user is already authenticated, redirect them to dashboard
    const token = getAuthToken();
    if (token) {
        window.location.href = 'dashboard.html';
    }
    
    // Set API Url display
    const currentApiUrlEl = document.getElementById('currentApiUrl');
    if (currentApiUrlEl) {
        currentApiUrlEl.innerText = getApiUrl();
    }
});

// Switch between Sign In and Register tabs
function switchAuthTab(tab) {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

// Toggle Organization select based on selected registration role
function toggleRegOrgSelect() {
    const roleSelect = document.getElementById('regRole');
    const orgGroup = document.getElementById('regOrgGroup');
    const orgInput = document.getElementById('regOrgId');
    
    if (roleSelect.value === 'ROLE_SYSTEM_GOVERNOR') {
        orgGroup.style.display = 'none';
        orgInput.required = false;
        orgInput.value = '';
    } else {
        orgGroup.style.display = 'block';
        orgInput.required = true;
    }
}

// Submit Login request
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        const data = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        // Save JWT token
        localStorage.setItem('greentrace_token', data.token);
        
        showToast(`Welcome back, ${data.name}! Resolving user profile...`, 'success');
        
        // Fetch full profile (e.g. resolve user organization ID and name)
        const profile = await fetchAndSaveUserProfile(email);
        
        if (!profile) {
            // Fallback user structure if users table doesn't have it
            const fallbackProfile = {
                id: null,
                name: data.name,
                email: data.email,
                role: data.role,
                organizationId: null,
                organizationName: data.role === 'ROLE_SYSTEM_GOVERNOR' ? 'System Admin' : 'Auditor'
            };
            localStorage.setItem('greentrace_user', JSON.stringify(fallbackProfile));
        }
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 800);
        
    } catch (error) {
        showToast(error.message || 'Login failed. Please check your credentials.', 'error');
    }
}

// Submit Register request
async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const orgInput = document.getElementById('regOrgId');
    const organizationId = (role === 'ROLE_ENVIRONMENTAL_AUDITOR' && orgInput.value) ? parseInt(orgInput.value) : null;
    
    const payload = {
        name,
        email,
        password,
        role,
        organizationId
    };
    
    try {
        const data = await apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        // Save JWT token
        localStorage.setItem('greentrace_token', data.token);
        
        showToast('Registration successful! Setting up user profile...', 'success');
        
        // Fetch full user profile
        await fetchAndSaveUserProfile(email);
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);
        
    } catch (error) {
        showToast(error.message || 'Registration failed. Try checking the Organization ID.', 'error');
    }
}
