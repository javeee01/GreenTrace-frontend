// GreenTrace Footprint Reports Controller

let currentPage = 0;
const pageSize = 10;
let organizationsList = [];
let selectedOrgFilter = '';

document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) return;
    
    // Render standard layout
    renderCommonLayout('reports', 'Footprint Reports');
    
    // Display workspace
    document.getElementById('appWorkspace').style.display = 'flex';
    
    // Initialize dependency structures and fetch reports
    initDataAndLoadReports();
});

// Load dependency data
async function initDataAndLoadReports() {
    const user = getAuthUser();
    if (!user) return;
    
    const isGovernor = user.role === 'ROLE_SYSTEM_GOVERNOR';
    
    try {
        if (isGovernor) {
            const orgsRes = await apiRequest('/api/organizations?page=0&size=100');
            organizationsList = orgsRes.content || [];
            
            populateOrgsDropdowns();
            selectedOrgFilter = '';
        } else {
            // Auditor is locked to their organization
            document.getElementById('reportFilters').style.display = 'none';
            document.getElementById('reportOrgSelectGroup').style.display = 'none';
            selectedOrgFilter = user.organizationId;
        }
        
        loadReports(currentPage);
    } catch (error) {
        showToast('Failed to load dependencies: ' + error.message, 'error');
    }
}

// Populate organization select options (for Governor only)
function populateOrgsDropdowns() {
    const filterSelect = document.getElementById('filterRepOrg');
    const formSelect = document.getElementById('repOrg');
    
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
function filterReports() {
    const filterSelect = document.getElementById('filterRepOrg');
    if (filterSelect) {
        selectedOrgFilter = filterSelect.value;
    }
    loadReports(0);
}

// Fetch footprint reports list
async function loadReports(page = 0) {
    currentPage = page;
    
    let endpoint = `/api/reports?page=${page}&size=${pageSize}`;
    if (selectedOrgFilter) {
        endpoint += `&organizationId=${selectedOrgFilter}`;
    }
    
    try {
        const response = await apiRequest(endpoint);
        const reports = response.content || [];
        
        renderReportsTable(reports);
        renderPagination(response);
    } catch (error) {
        showToast('Failed to load footprint reports: ' + error.message, 'error');
    }
}

// Render data rows
function renderReportsTable(reports) {
    const tbody = document.querySelector('#reportsTable tbody');
    tbody.innerHTML = '';
    
    const user = getAuthUser();
    const isGovernor = user && user.role === 'ROLE_SYSTEM_GOVERNOR';
    
    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No reports found.</td></tr>`;
        return;
    }
    
    reports.forEach(rep => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(rep.generatedAt).toLocaleString();
        const emissionVal = rep.totalEmissions.toLocaleString(undefined, {maximumFractionDigits: 2});
        
        const badgeClass = rep.status === 'FINAL' ? 'badge-final' : 'badge-draft';
        
        // Show Sign Off button if role is auditor and status is DRAFT
        const showSignOff = !isGovernor && rep.status === 'DRAFT';
        const signOffButton = showSignOff 
            ? `<button class="btn-icon edit" onclick="finalizeReport(${rep.id})" title="Sign Off / Finalize"><i class="fa-solid fa-file-signature"></i></button>`
            : '';
            
        tr.innerHTML = `
            <td>${rep.id}</td>
            <td><strong>${rep.organizationName || `Org #${rep.organizationId}`}</strong></td>
            <td>${rep.periodStart}</td>
            <td>${rep.periodEnd}</td>
            <td><strong style="color: var(--primary);">${emissionVal} kg CO2e</strong></td>
            <td>${formattedDate}</td>
            <td><span class="badge ${badgeClass}">${rep.status}</span></td>
            <td>
                <div class="table-actions">
                    ${signOffButton}
                    <button class="btn-icon delete" onclick="deleteReport(${rep.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render paginator
function renderPagination(pageData) {
    const container = document.getElementById('reportsPagination');
    if (!container) return;
    
    const totalPages = pageData.totalPages || 1;
    const isFirst = pageData.first;
    const isLast = pageData.last;
    
    let html = `<div>Showing page ${currentPage + 1} of ${totalPages}</div>`;
    html += `<div class="pagination-controls">`;
    
    html += `<button class="btn-page" onclick="loadReports(${currentPage - 1})" ${isFirst ? 'disabled' : ''}>&lt; Prev</button>`;
    
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="btn-page ${i === currentPage ? 'active' : ''}" onclick="loadReports(${i})">${i + 1}</button>`;
    }
    
    html += `<button class="btn-page" onclick="loadReports(${currentPage + 1})" ${isLast ? 'disabled' : ''}>Next &gt;</button>`;
    html += `</div>`;
    
    container.innerHTML = html;
}

// Open modal for report generation
function openReportModal() {
    document.getElementById('reportForm').reset();
    
    // Default dates (e.g. Q1/H1/Full year 2025)
    document.getElementById('repStart').value = '2025-01-01';
    document.getElementById('repEnd').value = '2025-06-30';
    
    // Set locked values
    const user = getAuthUser();
    if (user && user.role !== 'ROLE_SYSTEM_GOVERNOR') {
        const orgSelect = document.getElementById('repOrg');
        if (orgSelect) {
            orgSelect.required = false; // Ignored in submission, bound to profile ID
        }
    }
    
    openModal('modalReport');
}

// Submit report generation
async function submitReport(event) {
    event.preventDefault();
    
    const user = getAuthUser();
    if (!user) return;
    
    const periodStart = document.getElementById('repStart').value;
    const periodEnd = document.getElementById('repEnd').value;
    
    // Bind organization ID
    let organizationId = user.organizationId;
    if (user.role === 'ROLE_SYSTEM_GOVERNOR') {
        const orgSelect = document.getElementById('repOrg');
        organizationId = parseInt(orgSelect.value);
        if (isNaN(organizationId)) {
            showToast('Please select an organization', 'error');
            return;
        }
    }
    
    const payload = {
        organizationId,
        periodStart,
        periodEnd
    };
    
    try {
        await apiRequest('/api/reports/generate', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        closeModal('modalReport');
        showToast('Carbon footprint report generated successfully!', 'success');
        loadReports(currentPage);
    } catch (error) {
        showToast('Failed to generate report: ' + error.message, 'error');
    }
}

// Sign off / Finalize a report status
async function finalizeReport(id) {
    if (!confirm('Are you sure you want to sign off and finalize this report? Once finalized, it cannot be modified.')) {
        return;
    }
    
    try {
        await apiRequest(`/api/reports/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'FINAL' })
        });
        showToast('Report signed off and finalized successfully!', 'success');
        loadReports(currentPage);
    } catch (error) {
        showToast('Failed to finalize report: ' + error.message, 'error');
    }
}

// Delete report
async function deleteReport(id) {
    if (!confirm('Are you sure you want to delete this generated report?')) {
        return;
    }
    
    try {
        await apiRequest(`/api/reports/${id}`, {
            method: 'DELETE'
        });
        showToast('Footprint report successfully deleted!', 'success');
        loadReports(currentPage);
    } catch (error) {
        showToast('Failed to delete report: ' + error.message, 'error');
    }
}
