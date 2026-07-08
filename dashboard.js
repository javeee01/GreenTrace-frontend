// GreenTrace Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial auth check
    if (!getAuthToken()) return;
    
    const user = getAuthUser();
    if (!user) return;
    
    const isGovernor = user.role === 'ROLE_SYSTEM_GOVERNOR';
    
    // 2. Render layout
    renderCommonLayout(
        isGovernor ? 'dashboard-gov' : 'dashboard-aud',
        isGovernor ? 'Governor Dashboard' : 'Auditor Dashboard'
    );
    
    // Display workspace
    document.getElementById('appWorkspace').style.display = 'flex';
    
    // 3. Load stats
    if (isGovernor) {
        document.getElementById('govDashboard').style.display = 'block';
        loadGovernorStats();
    } else {
        document.getElementById('audDashboard').style.display = 'block';
        loadAuditorStats();
    }
});

// Load Governor Metrics and Charts
async function loadGovernorStats() {
    try {
        // Fetch stats counts
        const orgsRes = await apiRequest('/api/organizations?page=0&size=100');
        const usersRes = await apiRequest('/api/users?page=0&size=100');
        const factorsRes = await apiRequest('/api/emission-factors?page=0&size=100');
        const activitiesRes = await apiRequest('/api/activities?page=0&size=1000');
        
        const orgs = orgsRes.content || [];
        const users = usersRes.content || [];
        const factors = factorsRes.content || [];
        const activities = activitiesRes.content || [];
        
        document.getElementById('govStatOrgs').innerText = orgs.length;
        document.getElementById('govStatUsers').innerText = users.length;
        document.getElementById('govStatFactors').innerText = factors.length;
        
        // --- 1. Organizations Comparison Bar Chart ---
        const orgEmissions = {};
        // Initialize all orgs with 0
        orgs.forEach(o => {
            orgEmissions[o.name] = 0;
        });
        // Aggregate calculated CO2
        activities.forEach(act => {
            const orgName = act.organizationName || `Org #${act.organizationId}`;
            orgEmissions[orgName] = (orgEmissions[orgName] || 0) + act.calculatedCo2;
        });
        
        const orgLabels = Object.keys(orgEmissions);
        const orgData = Object.values(orgEmissions);
        
        renderGovernorCompareChart(orgLabels, orgData);
        
        // --- 2. Industry Distribution Doughnut Chart ---
        const industries = {};
        orgs.forEach(o => {
            const ind = o.industry || 'Unknown';
            industries[ind] = (industries[ind] || 0) + 1;
        });
        
        renderGovernorIndustryChart(Object.keys(industries), Object.values(industries));
        
    } catch (error) {
        showToast('Error loading Governor metrics: ' + error.message, 'error');
    }
}

// Load Auditor Metrics and Charts
async function loadAuditorStats() {
    const user = getAuthUser();
    if (!user || !user.organizationId) {
        showToast('Auditor has no associated organization.', 'error');
        return;
    }
    
    try {
        document.getElementById('audStatOrgName').innerText = user.organizationName;
        
        // Fetch organization specific carbon activities and reports
        const activitiesRes = await apiRequest(`/api/activities?organizationId=${user.organizationId}&page=0&size=1000`);
        const reportsRes = await apiRequest(`/api/reports?organizationId=${user.organizationId}&page=0&size=100`);
        
        const activities = activitiesRes.content || [];
        const reports = reportsRes.content || [];
        
        document.getElementById('audStatActivities').innerText = activities.length;
        document.getElementById('audStatReports').innerText = reports.length;
        
        // Total emissions calculations
        let totalEmissions = 0;
        activities.forEach(act => {
            totalEmissions += act.calculatedCo2;
        });
        
        document.getElementById('audStatEmissions').innerText = `${totalEmissions.toLocaleString(undefined, {maximumFractionDigits: 1})} kg`;
        
        // --- Monthly Trend Line Chart ---
        // Group activities by month in 2025/2026
        const monthlyData = {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Default past 6 months or months in activity list
        activities.forEach(act => {
            const dateStr = act.activityDate; // e.g. "2025-06-15"
            if (dateStr) {
                const date = new Date(dateStr);
                const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                monthlyData[monthYear] = (monthlyData[monthYear] || 0) + act.calculatedCo2;
            }
        });
        
        // If empty, put mock monthly labels to look nice
        let monthsLabels = Object.keys(monthlyData);
        let emissionsValues = Object.values(monthlyData);
        
        if (monthsLabels.length === 0) {
            monthsLabels = ['Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025'];
            emissionsValues = [0, 0, 0, 0, 0, 0];
        } else {
            // Sort keys chronologically
            const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
                const partsA = a.split(' ');
                const partsB = b.split(' ');
                const dateA = new Date(`${partsA[0]} 1, ${partsA[1]}`);
                const dateB = new Date(`${partsB[0]} 1, ${partsB[1]}`);
                return dateA - dateB;
            });
            monthsLabels = sortedMonths;
            emissionsValues = sortedMonths.map(m => monthlyData[m]);
        }
        
        renderAuditorTrendChart(monthsLabels, emissionsValues);
        
    } catch (error) {
        showToast('Error loading Auditor metrics: ' + error.message, 'error');
    }
}

// Chart.js Renders
let compareChartObj = null;
function renderGovernorCompareChart(labels, data) {
    const ctx = document.getElementById('govCompareChart').getContext('2d');
    if (compareChartObj) compareChartObj.destroy();
    
    compareChartObj = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Emissions',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#111827', titleColor: '#fff', bodyColor: '#ccc' }
            },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

let industryChartObj = null;
function renderGovernorIndustryChart(labels, data) {
    const ctx = document.getElementById('govIndustryChart').getContext('2d');
    if (industryChartObj) industryChartObj.destroy();
    
    industryChartObj = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', 
                    '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'
                ],
                borderWidth: 1,
                borderColor: '#111827'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 11 } } },
                tooltip: { backgroundColor: '#111827' }
            }
        }
    });
}

let trendChartObj = null;
function renderAuditorTrendChart(labels, data) {
    const ctx = document.getElementById('audMonthlyChart').getContext('2d');
    if (trendChartObj) trendChartObj.destroy();
    
    trendChartObj = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Emissions',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#111827' }
            },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}
