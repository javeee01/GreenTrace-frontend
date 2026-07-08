// GreenTrace Emission Factors Controller

let currentPage = 0;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) return;
    
    // Check if Governor
    const user = getAuthUser();
    if (user && user.role !== 'ROLE_SYSTEM_GOVERNOR') {
        showToast('Unauthorized access to Emission Factors', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1000);
        return;
    }
    
    // Render standard layout
    renderCommonLayout('factors', 'Emission Factors');
    
    // Display workspace
    document.getElementById('appWorkspace').style.display = 'flex';
    
    // Load emission factors
    loadFactors(currentPage);
});

// Fetch factors list
async function loadFactors(page = 0) {
    currentPage = page;
    try {
        const response = await apiRequest(`/api/emission-factors?page=${page}&size=${pageSize}`);
        const factors = response.content || [];
        
        renderFactorsTable(factors);
        renderPagination(response);
    } catch (error) {
        showToast('Failed to load emission factors: ' + error.message, 'error');
    }
}

// Render data rows
function renderFactorsTable(factors) {
    const tbody = document.querySelector('#factorsTable tbody');
    tbody.innerHTML = '';
    
    if (factors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No factors found.</td></tr>`;
        return;
    }
    
    factors.forEach(fac => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${fac.id}</td>
            <td><strong>${fac.activityType}</strong></td>
            <td>${fac.description || '-'}</td>
            <td>${fac.kgCo2PerUnit}</td>
            <td><span class="org-badge">${fac.unit}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon edit" onclick="editFactor(${fac.id})" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn-icon delete" onclick="deleteFactor(${fac.id}, '${fac.activityType}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render paginator buttons
function renderPagination(pageData) {
    const container = document.getElementById('factorsPagination');
    if (!container) return;
    
    const totalPages = pageData.totalPages || 1;
    const isFirst = pageData.first;
    const isLast = pageData.last;
    
    let html = `<div>Showing page ${currentPage + 1} of ${totalPages}</div>`;
    html += `<div class="pagination-controls">`;
    
    html += `<button class="btn-page" onclick="loadFactors(${currentPage - 1})" ${isFirst ? 'disabled' : ''}>&lt; Prev</button>`;
    
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="btn-page ${i === currentPage ? 'active' : ''}" onclick="loadFactors(${i})">${i + 1}</button>`;
    }
    
    html += `<button class="btn-page" onclick="loadFactors(${currentPage + 1})" ${isLast ? 'disabled' : ''}>Next &gt;</button>`;
    html += `</div>`;
    
    container.innerHTML = html;
}

// Open modal for addition
function openFactorModal() {
    document.getElementById('factorForm').reset();
    document.getElementById('factorId').value = '';
    document.getElementById('factorModalTitle').innerText = 'Add Emission Factor';
    openModal('modalFactor');
}

// Open modal for editing
async function editFactor(id) {
    try {
        const fac = await apiRequest(`/api/emission-factors/${id}`);
        document.getElementById('factorId').value = fac.id;
        document.getElementById('facActivityType').value = fac.activityType;
        document.getElementById('facDescription').value = fac.description || '';
        document.getElementById('facKgCo2').value = fac.kgCo2PerUnit;
        document.getElementById('facUnit').value = fac.unit;
        
        document.getElementById('factorModalTitle').innerText = 'Edit Emission Factor';
        openModal('modalFactor');
    } catch (error) {
        showToast('Error fetching factor details: ' + error.message, 'error');
    }
}

// Submit emission factor details form
async function submitFactor(event) {
    event.preventDefault();
    
    const id = document.getElementById('factorId').value;
    const activityType = document.getElementById('facActivityType').value.trim();
    const description = document.getElementById('facDescription').value.trim();
    const kgCo2PerUnit = parseFloat(document.getElementById('facKgCo2').value);
    const unit = document.getElementById('facUnit').value.trim();
    
    const payload = { activityType, description, kgCo2PerUnit, unit };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/emission-factors/${id}` : '/api/emission-factors';
    
    try {
        await apiRequest(url, {
            method: method,
            body: JSON.stringify(payload)
        });
        
        closeModal('modalFactor');
        showToast(`Emission factor successfully ${id ? 'updated' : 'added'}!`, 'success');
        loadFactors(currentPage);
    } catch (error) {
        showToast('Failed to save emission factor: ' + error.message, 'error');
    }
}

// Delete emission factor
async function deleteFactor(id, type) {
    if (!confirm(`Are you sure you want to delete emission factor "${type}"? This will fail if there are associated activities.`)) {
        return;
    }
    
    try {
        await apiRequest(`/api/emission-factors/${id}`, {
            method: 'DELETE'
        });
        showToast(`Emission factor "${type}" successfully deleted!`, 'success');
        loadFactors(currentPage);
    } catch (error) {
        showToast('Failed to delete emission factor: ' + error.message, 'error');
    }
}
