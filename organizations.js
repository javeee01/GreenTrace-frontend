// GreenTrace Organizations Controller

let currentPage = 0;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) return;
    
    // Check if user is Governor (only Governors can manage Orgs)
    const user = getAuthUser();
    if (user && user.role !== 'ROLE_SYSTEM_GOVERNOR') {
        showToast('Unauthorized access to Organizations', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1000);
        return;
    }
    
    // Render standard layout
    renderCommonLayout('organizations', 'Organizations');
    
    // Display workspace
    document.getElementById('appWorkspace').style.display = 'flex';
    
    // Load organizations
    loadOrganizations(currentPage);
});

// Fetch organizations list
async function loadOrganizations(page = 0) {
    currentPage = page;
    try {
        const response = await apiRequest(`/api/organizations?page=${page}&size=${pageSize}`);
        const orgs = response.content || [];
        
        renderOrgsTable(orgs);
        renderPagination(response);
    } catch (error) {
        showToast('Failed to load organizations: ' + error.message, 'error');
    }
}

// Render data rows
function renderOrgsTable(orgs) {
    const tbody = document.querySelector('#orgsTable tbody');
    tbody.innerHTML = '';
    
    if (orgs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No organizations found.</td></tr>`;
        return;
    }
    
    orgs.forEach(org => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${org.id}</td>
            <td><strong>${org.name}</strong></td>
            <td>${org.industry || '-'}</td>
            <td>${org.country || '-'}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon edit" onclick="editOrg(${org.id})" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn-icon delete" onclick="deleteOrg(${org.id}, '${org.name}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render paginator buttons
function renderPagination(pageData) {
    const container = document.getElementById('orgsPagination');
    if (!container) return;
    
    const totalPages = pageData.totalPages || 1;
    const isFirst = pageData.first;
    const isLast = pageData.last;
    
    let html = `<div>Showing page ${currentPage + 1} of ${totalPages}</div>`;
    html += `<div class="pagination-controls">`;
    
    html += `<button class="btn-page" onclick="loadOrganizations(${currentPage - 1})" ${isFirst ? 'disabled' : ''}>&lt; Prev</button>`;
    
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="btn-page ${i === currentPage ? 'active' : ''}" onclick="loadOrganizations(${i})">${i + 1}</button>`;
    }
    
    html += `<button class="btn-page" onclick="loadOrganizations(${currentPage + 1})" ${isLast ? 'disabled' : ''}>Next &gt;</button>`;
    html += `</div>`;
    
    container.innerHTML = html;
}

// Open modal for addition
function openOrgModal() {
    document.getElementById('orgForm').reset();
    document.getElementById('orgId').value = '';
    document.getElementById('orgModalTitle').innerText = 'Add Organization';
    openModal('modalOrg');
}

// Open modal for editing
async function editOrg(id) {
    try {
        const org = await apiRequest(`/api/organizations/${id}`);
        document.getElementById('orgId').value = org.id;
        document.getElementById('orgName').value = org.name;
        document.getElementById('orgIndustry').value = org.industry || '';
        document.getElementById('orgCountry').value = org.country || '';
        
        document.getElementById('orgModalTitle').innerText = 'Edit Organization';
        openModal('modalOrg');
    } catch (error) {
        showToast('Error fetching organization details: ' + error.message, 'error');
    }
}

// Submit organization form
async function submitOrg(event) {
    event.preventDefault();
    
    const id = document.getElementById('orgId').value;
    const name = document.getElementById('orgName').value.trim();
    const industry = document.getElementById('orgIndustry').value.trim();
    const country = document.getElementById('orgCountry').value.trim();
    
    const payload = { name, industry, country };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/organizations/${id}` : '/api/organizations';
    
    try {
        await apiRequest(url, {
            method: method,
            body: JSON.stringify(payload)
        });
        
        closeModal('modalOrg');
        showToast(`Organization successfully ${id ? 'updated' : 'added'}!`, 'success');
        loadOrganizations(currentPage);
    } catch (error) {
        showToast('Failed to save organization: ' + error.message, 'error');
    }
}

// Delete organization
async function deleteOrg(id, name) {
    if (!confirm(`Are you sure you want to delete organization "${name}"? This will fail if there are associated activities or users.`)) {
        return;
    }
    
    try {
        await apiRequest(`/api/organizations/${id}`, {
            method: 'DELETE'
        });
        showToast(`Organization "${name}" successfully deleted!`, 'success');
        loadOrganizations(currentPage);
    } catch (error) {
        showToast('Failed to delete organization: ' + error.message, 'error');
    }
}
