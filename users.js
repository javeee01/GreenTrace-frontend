// GreenTrace User Accounts Controller

let currentPage = 0;
const pageSize = 10;
let organizationsList = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) return;
    
    // Check if Governor
    const user = getAuthUser();
    if (user && user.role !== 'ROLE_SYSTEM_GOVERNOR') {
        showToast('Unauthorized access to User Accounts', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1000);
        return;
    }
    
    // Render standard layout
    renderCommonLayout('users', 'User Accounts');
    
    // Display workspace
    document.getElementById('appWorkspace').style.display = 'flex';
    
    // Load data dependencies first, then users
    initDataAndLoadUsers();
});

// Fetch organizations for the dropdown and then load users
async function initDataAndLoadUsers() {
    try {
        const response = await apiRequest('/api/organizations?page=0&size=100');
        organizationsList = response.content || [];
        
        // Populate organization dropdown
        populateOrgDropdown();
        
        // Load users list
        loadUsers(currentPage);
    } catch (error) {
        showToast('Failed to load dependencies: ' + error.message, 'error');
    }
}

// Populate organization select
function populateOrgDropdown() {
    const select = document.getElementById('userOrg');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- No Organization (System Level) --</option>';
    organizationsList.forEach(org => {
        select.innerHTML += `<option value="${org.id}">${org.name}</option>`;
    });
}

// Load paginated users
async function loadUsers(page = 0) {
    currentPage = page;
    try {
        const response = await apiRequest(`/api/users?page=${page}&size=${pageSize}`);
        const users = response.content || [];
        
        renderUsersTable(users);
        renderPagination(response);
    } catch (error) {
        showToast('Failed to load user accounts: ' + error.message, 'error');
    }
}

// Render data rows
function renderUsersTable(users) {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';
    
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No users found.</td></tr>`;
        return;
    }
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        const roleLabel = u.role === 'ROLE_SYSTEM_GOVERNOR' ? 'Governor' : 'Auditor';
        const roleClass = u.role === 'ROLE_SYSTEM_GOVERNOR' ? 'badge-role' : 'badge-draft';
        const orgLabel = u.organizationName || '-';
        
        tr.innerHTML = `
            <td>${u.id}</td>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td><span class="badge ${roleClass}">${roleLabel}</span></td>
            <td>${orgLabel}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon edit" onclick="editUser(${u.id})" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn-icon delete" onclick="deleteUser(${u.id}, '${u.name}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render pagination
function renderPagination(pageData) {
    const container = document.getElementById('usersPagination');
    if (!container) return;
    
    const totalPages = pageData.totalPages || 1;
    const isFirst = pageData.first;
    const isLast = pageData.last;
    
    let html = `<div>Showing page ${currentPage + 1} of ${totalPages}</div>`;
    html += `<div class="pagination-controls">`;
    
    html += `<button class="btn-page" onclick="loadUsers(${currentPage - 1})" ${isFirst ? 'disabled' : ''}>&lt; Prev</button>`;
    
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="btn-page ${i === currentPage ? 'active' : ''}" onclick="loadUsers(${i})">${i + 1}</button>`;
    }
    
    html += `<button class="btn-page" onclick="loadUsers(${currentPage + 1})" ${isLast ? 'disabled' : ''}>Next &gt;</button>`;
    html += `</div>`;
    
    container.innerHTML = html;
}

// Show/hide organization dropdown based on role
function toggleUserOrgSelect() {
    const roleSelect = document.getElementById('userRole');
    const orgGroup = document.getElementById('userOrgGroup');
    const orgSelect = document.getElementById('userOrg');
    
    if (roleSelect.value === 'ROLE_SYSTEM_GOVERNOR') {
        orgGroup.style.display = 'none';
        orgSelect.value = '';
    } else {
        orgGroup.style.display = 'block';
    }
}

// Open modal for creation
function openUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userPasswordHelp').style.display = 'none';
    document.getElementById('userPassword').required = true;
    document.getElementById('userModalTitle').innerText = 'Add User Account';
    toggleUserOrgSelect();
    openModal('modalUser');
}

// Open modal for editing
async function editUser(id) {
    try {
        const user = await apiRequest(`/api/users/${id}`);
        
        document.getElementById('userId').value = user.id;
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userPassword').value = '';
        document.getElementById('userPassword').required = false; // Optional on edit
        document.getElementById('userPasswordHelp').style.display = 'inline';
        
        document.getElementById('userRole').value = user.role;
        toggleUserOrgSelect();
        
        if (user.organizationId) {
            document.getElementById('userOrg').value = user.organizationId;
        } else {
            document.getElementById('userOrg').value = '';
        }
        
        document.getElementById('userModalTitle').innerText = 'Edit User Account';
        openModal('modalUser');
    } catch (error) {
        showToast('Error fetching user details: ' + error.message, 'error');
    }
}

// Submit user details form
async function submitUser(event) {
    event.preventDefault();
    
    const id = document.getElementById('userId').value;
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const orgSelect = document.getElementById('userOrg');
    const organizationId = role === 'ROLE_ENVIRONMENTAL_AUDITOR' && orgSelect.value ? parseInt(orgSelect.value) : null;
    
    const payload = {
        name,
        email,
        password: password || null,
        role,
        organizationId
    };
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/users/${id}` : '/api/users';
    
    try {
        await apiRequest(url, {
            method: method,
            body: JSON.stringify(payload)
        });
        
        closeModal('modalUser');
        showToast(`User account successfully ${id ? 'updated' : 'added'}!`, 'success');
        loadUsers(currentPage);
    } catch (error) {
        showToast('Failed to save user account: ' + error.message, 'error');
    }
}

// Delete user account
async function deleteUser(id, name) {
    const user = getAuthUser();
    if (user && user.id === id) {
        showToast('You cannot delete your own account!', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete user account "${name}"?`)) {
        return;
    }
    
    try {
        await apiRequest(`/api/users/${id}`, {
            method: 'DELETE'
        });
        showToast(`User "${name}" successfully deleted!`, 'success');
        loadUsers(currentPage);
    } catch (error) {
        showToast('Failed to delete user: ' + error.message, 'error');
    }
}
