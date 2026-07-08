// GreenTrace Carbon Activities Controller

let currentPage = 0;
const pageSize = 10;
let organizationsList = [];
let emissionFactorsList = [];
let selectedOrgFilter = '';

document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) return;
    
    // Render standard layout
    renderCommonLayout('activities', 'Carbon Activities');
    
    // Display workspace
    document.getElementById('appWorkspace').style.display = 'flex';
    
    // Initialize data dependencies and load activities
    initDataAndLoadActivities();
});

// Load organizations and emission factors first
async function initDataAndLoadActivities() {
    const user = getAuthUser();
    if (!user) return;
    
    const isGovernor = user.role === 'ROLE_SYSTEM_GOVERNOR';
    
    try {
        // Fetch Emission Factors (needed for dropdown)
        const factorsRes = await apiRequest('/api/emission-factors?page=0&size=100');
        emissionFactorsList = factorsRes.content || [];
        populateFactorsDropdown();
        
        // Handle role specific filters
        if (isGovernor) {
            const orgsRes = await apiRequest('/api/organizations?page=0&size=100');
            organizationsList = orgsRes.content || [];
            
            populateOrgsDropdowns();
            selectedOrgFilter = '';
        } else {
            // Auditor is locked to their organization
            document.getElementById('activityFilters').style.display = 'none';
            document.getElementById('activityOrgSelectGroup').style.display = 'none';
            selectedOrgFilter = user.organizationId;
        }
        
        loadActivities(currentPage);
    } catch (error) {
        showToast('Failed to load dependencies: ' + error.message, 'error');
    }
}

// Populate emission factor select options
function populateFactorsDropdown() {
    const select = document.getElementById('actFactor');
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>-- Select Emission Factor --</option>';
    emissionFactorsList.forEach(fac => {
        select.innerHTML += `<option value="${fac.id}">${fac.activityType} (${fac.kgCo2PerUnit} kg CO2e / ${fac.unit})</option>`;
    });
}

// Populate organization select options (for Governor only)
function populateOrgsDropdowns() {
    const filterSelect = document.getElementById('filterActOrg');
    const formSelect = document.getElementById('actOrg');
    
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Organizations</option>';
        organizationsList.forEach(org => {
            filterSelect.innerHTML += `<option value="${org.id}">${org.name}</option>`;
        });
    }
    
    if (formSelect) {
        formSelect.innerHTML = '<option value="" disabled selected>-- Select Organization --</option>';
        organizationsList.forEach(org => {
            formSelect.innerHTML += `<option value="${org.id}">${org.name}</option>`;
        });
    }
}

// Filter triggers
function filterActivities() {
    const filterSelect = document.getElementById('filterActOrg');
    if (filterSelect) {
        selectedOrgFilter = filterSelect.value;
    }
    loadActivities(0);
}

// Fetch activities log
async function loadActivities(page = 0) {
    currentPage = page;
    
    let endpoint = `/api/activities?page=${page}&size=${pageSize}`;
    if (selectedOrgFilter) {
        endpoint += `&organizationId=${selectedOrgFilter}`;
    }
    
    try {
        const response = await apiRequest(endpoint);
        const activities = response.content || [];
        
        renderActivitiesTable(activities);
        renderPagination(response);
    } catch (error) {
        showToast('Failed to load activities: ' + error.message, 'error');
    }
}

// Render table rows
function renderActivitiesTable(activities) {
    const tbody = document.querySelector('#activitiesTable tbody');
    tbody.innerHTML = '';
    
    if (activities.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No activity logs found.</td></tr>`;
        return;
    }
    
    activities.forEach(act => {
        const tr = document.createElement('tr');
        const recordedBy = act.recordedByName || `User #${act.recordedById}`;
        const co2Val = act.calculatedCo2.toLocaleString(undefined, {maximumFractionDigits: 2});
        
        tr.innerHTML = `
            <td>${act.id}</td>
            <td><strong>${act.organizationName || `Org #${act.organizationId}`}</strong></td>
            <td>${act.activityDate}</td>
            <td>${act.activityType || `Factor #${act.emissionFactorId}`}</td>
            <td>${act.quantity}</td>
            <td><strong style="color: var(--primary);">${co2Val} kg</strong></td>
            <td>${recordedBy}</td>
            <td title="${act.notes || ''}" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${act.notes || '-'}
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon edit" onclick="editActivity(${act.id})" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn-icon delete" onclick="deleteActivity(${act.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render paginator
function renderPagination(pageData) {
    const container = document.getElementById('activitiesPagination');
    if (!container) return;
    
    const totalPages = pageData.totalPages || 1;
    const isFirst = pageData.first;
    const isLast = pageData.last;
    
    let html = `<div>Showing page ${currentPage + 1} of ${totalPages}</div>`;
    html += `<div class="pagination-controls">`;
    
    html += `<button class="btn-page" onclick="loadActivities(${currentPage - 1})" ${isFirst ? 'disabled' : ''}>&lt; Prev</button>`;
    
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="btn-page ${i === currentPage ? 'active' : ''}" onclick="loadActivities(${i})">${i + 1}</button>`;
    }
    
    html += `<button class="btn-page" onclick="loadActivities(${currentPage + 1})" ${isLast ? 'disabled' : ''}>Next &gt;</button>`;
    html += `</div>`;
    
    container.innerHTML = html;
}

// Open modal for recording activity
function openActivityModal() {
    document.getElementById('activityForm').reset();
    document.getElementById('activityId').value = '';
    document.getElementById('activityModalTitle').innerText = 'Record Carbon Activity';
    
    // Prefill date with today
    document.getElementById('actDate').value = new Date().toISOString().split('T')[0];
    
    // Set locked values
    const user = getAuthUser();
    if (user && user.role !== 'ROLE_SYSTEM_GOVERNOR') {
        const orgSelect = document.getElementById('actOrg');
        if (orgSelect) {
            orgSelect.required = false; // Ignored in submission, bound to profile ID
        }
    }
    
    openModal('modalActivity');
}

// Open modal for editing activity
async function editActivity(id) {
    try {
        const act = await apiRequest(`/api/activities/${id}`);
        
        document.getElementById('activityId').value = act.id;
        document.getElementById('actFactor').value = act.emissionFactorId;
        document.getElementById('actQuantity').value = act.quantity;
        document.getElementById('actDate').value = act.activityDate;
        document.getElementById('actNotes').value = act.notes || '';
        
        const user = getAuthUser();
        if (user && user.role === 'ROLE_SYSTEM_GOVERNOR') {
            document.getElementById('actOrg').value = act.organizationId;
        }
        
        document.getElementById('activityModalTitle').innerText = 'Edit Carbon Activity';
        openModal('modalActivity');
    } catch (error) {
        showToast('Error fetching activity details: ' + error.message, 'error');
    }
}

// Submit activity form details
async function submitActivity(event) {
    event.preventDefault();
    
    const user = getAuthUser();
    if (!user) return;
    
    const id = document.getElementById('activityId').value;
    const factorId = parseInt(document.getElementById('actFactor').value);
    const quantity = parseFloat(document.getElementById('actQuantity').value);
    const activityDate = document.getElementById('actDate').value;
    const notes = document.getElementById('actNotes').value.trim();
    
    // Bind organization ID
    let organizationId = user.organizationId;
    if (user.role === 'ROLE_SYSTEM_GOVERNOR') {
        const orgSelect = document.getElementById('actOrg');
        organizationId = parseInt(orgSelect.value);
        if (isNaN(organizationId)) {
            showToast('Please select an organization', 'error');
            return;
        }
    }
    
    const payload = {
        organizationId,
        emissionFactorId: factorId,
        quantity,
        activityDate,
        notes,
        recordedById: user.id // User profile ID resolved during login
    };
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/activities/${id}` : '/api/activities';
    
    try {
        await apiRequest(url, {
            method: method,
            body: JSON.stringify(payload)
        });
        
        closeModal('modalActivity');
        showToast(`Carbon activity successfully ${id ? 'updated' : 'recorded'}!`, 'success');
        loadActivities(currentPage);
    } catch (error) {
        showToast('Failed to record activity: ' + error.message, 'error');
    }
}

// Delete activity
async function deleteActivity(id) {
    if (!confirm('Are you sure you want to delete this recorded carbon activity?')) {
        return;
    }
    
    try {
        await apiRequest(`/api/activities/${id}`, {
            method: 'DELETE'
        });
        showToast('Carbon activity successfully deleted!', 'success');
        loadActivities(currentPage);
    } catch (error) {
        showToast('Failed to delete activity: ' + error.message, 'error');
    }
}
