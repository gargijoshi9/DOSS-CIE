/**
 * COLLEGE STUDENT ADMINISTRATION PORTAL v2.0
 * Client-side Controller & REST API Integration
 */

// Application State
const state = {
  students: [],
  stats: null,
  currentView: 'dashboard',
  selectedStudent: null,
  deleteTargetStudent: null,
  searchQuery: '',
  filters: {
    category: 'All',
    feeStatus: 'All',
    scholarshipStatus: 'All',
    sort: 'newest'
  }
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initDateDisplay();
  setupNavigation();
  setupSearchAndFilters();
  setupAdmissionForm();
  setupStudentFormModal();
  setupDeleteModal();
  setupProfileModalActions();
  setupSettingsActions();
  setupGlobalShortcuts();

  // Initial Data Fetch
  loadAllData();
});

function initDateDisplay() {
  const el = document.getElementById('header-date');
  if (el) {
    const today = new Date();
    el.textContent = today.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
}

// ==========================================================================
// DATA FETCHING & API SERVICES
// ==========================================================================
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.error || (data.details ? data.details.join(', ') : 'API request failed');
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

async function loadAllData() {
  try {
    const [students, stats] = await Promise.all([
      apiFetch('/api/students'),
      apiFetch('/api/stats')
    ]);

    state.students = students;
    state.stats = stats;

    renderKPIsAndStats();
    renderCurrentView();
  } catch (err) {
    showToast(`Error loading data: ${err.message}`, 'error');
  }
}

// ==========================================================================
// NAVIGATION & ROUTING
// ==========================================================================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');

  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
      if (sidebar) sidebar.classList.remove('open');
    });
  });

  // Cross-view quick links
  document.getElementById('btn-goto-students')?.addEventListener('click', () => switchView('students'));
  document.getElementById('btn-goto-fees')?.addEventListener('click', () => switchView('fees'));
  document.getElementById('btn-dash-add-student')?.addEventListener('click', () => openStudentFormModal());
}

function switchView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-view') === viewName);
  });

  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.toggle('active', section.id === `view-${viewName}`);
  });

  // Update Page Header Title
  const titles = {
    dashboard: 'Dashboard Overview',
    students: 'Student Records Directory',
    admissions: 'New Student Admission Desk',
    documents: 'Document Compliance Tracker',
    fees: 'Fee Reconciliation & Verification Desk',
    scholarships: 'Scholarship Administration Desk',
    settings: 'System Information & DevOps Setup'
  };

  const headingEl = document.getElementById('page-heading');
  if (headingEl) {
    headingEl.textContent = titles[viewName] || 'Portal Overview';
  }

  renderCurrentView();
}

function renderCurrentView() {
  switch (state.currentView) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'students':
      renderStudentsTable();
      break;
    case 'admissions':
      updateAdmissionDocumentList();
      break;
    case 'documents':
      renderDocumentsTracker();
      break;
    case 'fees':
      renderFeesView();
      break;
    case 'scholarships':
      renderScholarshipsView();
      break;
    case 'settings':
      // Settings static & links
      break;
  }
}

// ==========================================================================
// DASHBOARD RENDERING
// ==========================================================================
function renderKPIsAndStats() {
  if (!state.stats) return;
  const { kpis, categoryDistribution, feeDistribution, actionRequired } = state.stats;

  // KPI Elements
  document.getElementById('kpi-total-students').textContent = kpis.totalStudents;
  document.getElementById('kpi-pending-fees').textContent = kpis.pendingFeeCount;
  document.getElementById('kpi-pending-amount').textContent = `₹${kpis.totalPendingAmount.toLocaleString('en-IN')} Outstanding`;
  document.getElementById('kpi-active-scholarships').textContent = kpis.activeScholarships;
  document.getElementById('kpi-missing-docs').textContent = kpis.missingDocumentsCount;

  // Sidebar Badges
  document.getElementById('badge-total-students').textContent = kpis.totalStudents;
  document.getElementById('badge-pending-fees').textContent = kpis.pendingFeeCount;
  document.getElementById('badge-active-scholarships').textContent = kpis.activeScholarships;
  document.getElementById('badge-missing-docs').textContent = kpis.missingDocumentsCount;

  // Category Distribution Bars
  const catContainer = document.getElementById('category-distribution-container');
  if (catContainer) {
    const total = kpis.totalStudents || 1;
    const catColors = {
      General: '#1e3a8a',
      SC: '#059669',
      ST: '#d97706',
      OBC: '#7c3aed'
    };

    catContainer.innerHTML = Object.entries(categoryDistribution).map(([cat, count]) => {
      const pct = Math.round((count / total) * 100);
      const color = catColors[cat] || '#2563eb';
      return `
        <div class="dist-item">
          <div class="dist-info">
            <span>${cat} Category</span>
            <span><strong>${count}</strong> (${pct}%)</span>
          </div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Fee Distribution Bars
  const feeContainer = document.getElementById('fee-distribution-container');
  if (feeContainer) {
    const total = kpis.totalStudents || 1;
    const feeColors = {
      Paid: '#059669',
      Partial: '#d97706',
      Unpaid: '#dc2626'
    };

    feeContainer.innerHTML = Object.entries(feeDistribution).map(([status, count]) => {
      const pct = Math.round((count / total) * 100);
      const color = feeColors[status] || '#64748b';
      return `
        <div class="dist-item">
          <div class="dist-info">
            <span>${status} Fees</span>
            <span><strong>${count}</strong> (${pct}%)</span>
          </div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Action Required Alerts
  const alertsContainer = document.getElementById('action-required-container');
  if (alertsContainer) {
    const totalAlerts = 
      actionRequired.unverifiedPaymentsCount +
      actionRequired.missingDocumentsCount +
      actionRequired.partialFeeCount +
      actionRequired.scholarshipsUnderReviewCount;

    document.getElementById('total-alerts-badge').textContent = `${totalAlerts} Desk Actions`;

    alertsContainer.innerHTML = `
      <div class="alert-item-box alert-amber" style="cursor: pointer;" onclick="filterAndNavigate('fees', 'unverified')">
        <div class="alert-item-left">
          <span class="alert-count text-warning">${actionRequired.unverifiedPaymentsCount}</span>
          <div>
            <span class="alert-title">Unverified Payments</span>
            <span class="alert-desc">Full fees paid, awaiting desk verification</span>
          </div>
        </div>
        <button class="btn btn-sm btn-outline">Verify &rarr;</button>
      </div>

      <div class="alert-item-box alert-rose" style="cursor: pointer;" onclick="filterAndNavigate('documents', 'missing')">
        <div class="alert-item-left">
          <span class="alert-count text-danger">${actionRequired.missingDocumentsCount}</span>
          <div>
            <span class="alert-title">Missing Compliance Files</span>
            <span class="alert-desc">Incomplete document checklists</span>
          </div>
        </div>
        <button class="btn btn-sm btn-outline">Review &rarr;</button>
      </div>

      <div class="alert-item-box alert-blue" style="cursor: pointer;" onclick="filterAndNavigate('fees', 'partial')">
        <div class="alert-item-left">
          <span class="alert-count text-primary">${actionRequired.partialFeeCount}</span>
          <div>
            <span class="alert-title">Partial Fee Balances</span>
            <span class="alert-desc">Installment dues pending collection</span>
          </div>
        </div>
        <button class="btn btn-sm btn-outline">Collect &rarr;</button>
      </div>

      <div class="alert-item-box alert-purple" style="cursor: pointer;" onclick="filterAndNavigate('scholarships', 'Under Review')">
        <div class="alert-item-left">
          <span class="alert-count text-purple">${actionRequired.scholarshipsUnderReviewCount}</span>
          <div>
            <span class="alert-title">Scholarships Under Review</span>
            <span class="alert-desc">Applications pending approval</span>
          </div>
        </div>
        <button class="btn btn-sm btn-outline">Audit &rarr;</button>
      </div>
    `;
  }
}

function renderDashboard() {
  renderKPIsAndStats();

  // Render Recent Admissions Table
  const tbody = document.getElementById('recent-admissions-tbody');
  if (!tbody || !state.stats) return;

  const recents = state.stats.recentAdmissions || [];
  if (recents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No recent admissions found.</td></tr>`;
    return;
  }

  tbody.innerHTML = recents.map(student => {
    return `
      <tr>
        <td>
          <strong>${escapeHtml(student.studentName)}</strong>
          <div class="student-meta-sub">${escapeHtml(student.academicYear || '')}</div>
        </td>
        <td><code>${escapeHtml(student.rollNumber)}</code></td>
        <td>${escapeHtml(student.course)}</td>
        <td>${getCategoryBadge(student.category)}</td>
        <td>${getFeeStatusBadge(student)}</td>
        <td>${getDocumentSummaryBadge(student)}</td>
        <td>${getScholarshipBadge(student.scholarshipStatus)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openStudentProfileModal('${student.id}')">View</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAndNavigate(view, filterValue) {
  switchView(view);
  if (view === 'fees') {
    const sel = document.getElementById('fee-table-filter');
    if (sel) {
      sel.value = filterValue;
      renderFeesView();
    }
  } else if (view === 'documents') {
    const sel = document.getElementById('doc-filter-compliance');
    if (sel) {
      sel.value = filterValue;
      renderDocumentsTracker();
    }
  } else if (view === 'scholarships') {
    const sel = document.getElementById('scholarship-table-filter');
    if (sel) {
      sel.value = filterValue;
      renderScholarshipsView();
    }
  }
}

// ==========================================================================
// STUDENTS DIRECTORY & CRUD OPERATIONS
// ==========================================================================
function setupSearchAndFilters() {
  const globalSearch = document.getElementById('global-search-input');
  const clearGlobalSearch = document.getElementById('clear-search-btn');
  const studentsSearch = document.getElementById('students-search-input');
  const categoryFilter = document.getElementById('filter-category');
  const feeStatusFilter = document.getElementById('filter-fee-status');
  const scholarshipFilter = document.getElementById('filter-scholarship');
  const sortFilter = document.getElementById('filter-sort');
  const resetBtn = document.getElementById('btn-reset-filters');
  const addStudentBtn = document.getElementById('btn-open-add-student-modal');

  // Sync Global Search & Table Search
  const handleSearch = (val) => {
    state.searchQuery = val.trim();
    if (studentsSearch && studentsSearch.value !== val) studentsSearch.value = val;
    if (globalSearch && globalSearch.value !== val) globalSearch.value = val;
    if (clearGlobalSearch) {
      clearGlobalSearch.style.display = val ? 'block' : 'none';
    }

    if (state.currentView !== 'students') {
      switchView('students');
    } else {
      renderStudentsTable();
    }
  };

  globalSearch?.addEventListener('input', (e) => handleSearch(e.target.value));
  studentsSearch?.addEventListener('input', (e) => handleSearch(e.target.value));

  clearGlobalSearch?.addEventListener('click', () => {
    handleSearch('');
  });

  categoryFilter?.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    renderStudentsTable();
  });

  feeStatusFilter?.addEventListener('change', (e) => {
    state.filters.feeStatus = e.target.value;
    renderStudentsTable();
  });

  scholarshipFilter?.addEventListener('change', (e) => {
    state.filters.scholarshipStatus = e.target.value;
    renderStudentsTable();
  });

  sortFilter?.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderStudentsTable();
  });

  resetBtn?.addEventListener('click', () => {
    state.searchQuery = '';
    state.filters = { category: 'All', feeStatus: 'All', scholarshipStatus: 'All', sort: 'newest' };
    if (globalSearch) globalSearch.value = '';
    if (studentsSearch) studentsSearch.value = '';
    if (clearGlobalSearch) clearGlobalSearch.style.display = 'none';
    if (categoryFilter) categoryFilter.value = 'All';
    if (feeStatusFilter) feeStatusFilter.value = 'All';
    if (scholarshipFilter) scholarshipFilter.value = 'All';
    if (sortFilter) sortFilter.value = 'newest';
    renderStudentsTable();
  });

  addStudentBtn?.addEventListener('click', () => openStudentFormModal());
}

function getFilteredStudents() {
  let list = [...state.students];
  const q = state.searchQuery.toLowerCase();

  // Search filter (name, roll, course)
  if (q) {
    list = list.filter(s =>
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
      (s.course && s.course.toLowerCase().includes(q))
    );
  }

  // Category filter
  if (state.filters.category !== 'All') {
    list = list.filter(s => s.category === state.filters.category);
  }

  // Fee Status filter
  if (state.filters.feeStatus !== 'All') {
    list = list.filter(s => s.feeStatus === state.filters.feeStatus);
  }

  // Scholarship Status filter
  if (state.filters.scholarshipStatus !== 'All') {
    list = list.filter(s => s.scholarshipStatus === state.filters.scholarshipStatus);
  }

  // Sorting
  switch (state.filters.sort) {
    case 'name-asc':
      list.sort((a, b) => a.studentName.localeCompare(b.studentName));
      break;
    case 'name-desc':
      list.sort((a, b) => b.studentName.localeCompare(a.studentName));
      break;
    case 'roll-asc':
      list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      break;
    case 'fee-desc':
      list.sort((a, b) => b.remainingFee - a.remainingFee);
      break;
    case 'newest':
    default:
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
  }

  return list;
}

function renderStudentsTable() {
  const tbody = document.getElementById('students-table-tbody');
  const emptyState = document.getElementById('students-empty-state');
  const countEl = document.getElementById('students-table-count');
  if (!tbody) return;

  const filtered = getFilteredStudents();

  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${state.students.length} students`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = filtered.map(student => {
    return `
      <tr>
        <td>
          <strong>${escapeHtml(student.studentName)}</strong>
          <div class="student-meta-sub">Enrolled ${escapeHtml(String(student.enrollmentYear || ''))} · ${escapeHtml(student.academicYear || '')}</div>
        </td>
        <td><code>${escapeHtml(student.rollNumber)}</code></td>
        <td>${escapeHtml(student.course)}</td>
        <td>${getCategoryBadge(student.category)}</td>
        <td>${getFeeStatusBadge(student)}</td>
        <td>${getDocumentSummaryBadge(student)}</td>
        <td>${getScholarshipBadge(student.scholarshipStatus)}</td>
        <td class="text-right">
          <div class="action-btn-group">
            <button class="btn-icon" title="View Profile" onclick="openStudentProfileModal('${student.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="btn-icon" title="Edit Student" onclick="openStudentFormModal('${student.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon btn-icon-danger" title="Delete Student" onclick="openDeleteConfirmModal('${student.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// ADMISSIONS DESK (NEW STUDENT FORM)
// ==========================================================================
function setupAdmissionForm() {
  const form = document.getElementById('admission-form');
  const categorySelect = document.getElementById('adm-category');
  const totalFeeInput = document.getElementById('adm-total-fee');
  const paidFeeInput = document.getElementById('adm-paid-fee');

  if (!form) return;

  // Dynamic Category Documents rule preview
  categorySelect?.addEventListener('change', () => {
    updateAdmissionDocumentList();
  });

  // Dynamic Fee preview
  const updateFeePreview = () => {
    const total = Number(totalFeeInput?.value) || 0;
    const paid = Number(paidFeeInput?.value) || 0;
    const remaining = Math.max(0, total - paid);

    const remEl = document.getElementById('adm-preview-remaining');
    const badgeEl = document.getElementById('adm-preview-badge');

    if (remEl) remEl.textContent = `₹${remaining.toLocaleString('en-IN')}`;

    if (badgeEl) {
      if (paid >= total && total > 0) {
        badgeEl.className = 'badge badge-paid';
        badgeEl.textContent = 'Paid';
      } else if (paid > 0 && paid < total) {
        badgeEl.className = 'badge badge-partial';
        badgeEl.textContent = 'Partial';
      } else {
        badgeEl.className = 'badge badge-unpaid';
        badgeEl.textContent = 'Unpaid';
      }
    }
  };

  totalFeeInput?.addEventListener('input', updateFeePreview);
  paidFeeInput?.addEventListener('input', updateFeePreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const studentName = document.getElementById('adm-student-name').value.trim();
    const rollNumber = document.getElementById('adm-roll-number').value.trim();
    const course = document.getElementById('adm-course').value;
    const academicYear = document.getElementById('adm-academic-year').value;
    const enrollmentYear = Number(document.getElementById('adm-enrollment-year').value);
    const category = document.getElementById('adm-category').value;
    const totalFee = Number(document.getElementById('adm-total-fee').value);
    const paidFee = Number(document.getElementById('adm-paid-fee').value);
    const scholarshipStatus = document.getElementById('adm-scholarship-status').value;

    // Client-side validation
    if (!studentName || !rollNumber || !course || !academicYear) {
      showToast('Please fill in all required admission fields', 'error');
      return;
    }

    if (isNaN(totalFee) || totalFee < 0 || isNaN(paidFee) || paidFee < 0) {
      showToast('Invalid fee numbers entered', 'error');
      return;
    }

    if (paidFee > totalFee) {
      showToast('Paid fee cannot exceed total assessed fee', 'error');
      return;
    }

    const payload = {
      studentName,
      rollNumber,
      course,
      academicYear,
      enrollmentYear,
      category,
      totalFee,
      paidFee,
      scholarshipStatus
    };

    try {
      const created = await apiFetch('/api/students', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast(`Student ${created.studentName} enrolled successfully!`, 'success');
      form.reset();
      updateAdmissionDocumentList();
      updateFeePreview();

      // Refresh data & switch to students list
      await loadAllData();
      switchView('students');
    } catch (err) {
      showToast(`Enrollment failed: ${err.message}`, 'error');
    }
  });

  updateAdmissionDocumentList();
  updateFeePreview();
}

function updateAdmissionDocumentList() {
  const category = document.getElementById('adm-category')?.value || 'General';
  const labelEl = document.getElementById('adm-category-label');
  const container = document.getElementById('adm-documents-checklist');
  if (!container) return;

  const isReserved = ['SC', 'ST', 'OBC'].includes(category);
  const docs = isReserved
    ? [
        { name: 'Admission Form', note: 'Standard Mandatory' },
        { name: 'ID Card', note: 'Standard Mandatory' },
        { name: 'Academic Transcript', note: 'Standard Mandatory' },
        { name: 'Fee Receipt', note: 'Standard Mandatory' },
        { name: 'Category Certificate', note: 'Government Reserved Quota Requirement' },
        { name: 'Income Certificate', note: 'Financial Subsidy Requirement' }
      ]
    : [
        { name: 'Admission Form', note: 'Standard Mandatory' },
        { name: 'ID Card', note: 'Standard Mandatory' },
        { name: 'Academic Transcript', note: 'Standard Mandatory' },
        { name: 'Fee Receipt', note: 'Standard Mandatory' }
      ];

  if (labelEl) {
    labelEl.textContent = `${category}: ${docs.length} Mandatory Documents`;
  }

  container.innerHTML = docs.map(d => `
    <div class="doc-check-row">
      <div>
        <strong>${d.name}</strong>
        <span class="text-xs text-muted" style="margin-left: 8px;">(${d.note})</span>
      </div>
      <span class="doc-status-pill pending">Pending on Enrollment</span>
    </div>
  `).join('');
}

// ==========================================================================
// DOCUMENTS COMPLIANCE VIEW
// ==========================================================================
function renderDocumentsTracker() {
  const tbody = document.getElementById('documents-table-tbody');
  const compFilter = document.getElementById('doc-filter-compliance')?.value || 'missing';
  const catFilter = document.getElementById('doc-filter-category')?.value || 'All';
  if (!tbody) return;

  let list = [...state.students];

  if (compFilter === 'missing') {
    list = list.filter(s => s.docSummary.pending > 0);
  } else if (compFilter === 'complete') {
    list = list.filter(s => s.docSummary.pending === 0);
  }

  if (catFilter !== 'All') {
    list = list.filter(s => s.category === catFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No students match document compliance filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(student => {
    const docs = student.documents || [];
    const docBadges = docs.map(d => {
      const isR = d.status === 'Received';
      return `
        <span class="doc-status-pill ${isR ? 'received' : 'pending'}" 
              title="Click to toggle '${escapeHtml(d.name)}'" 
              onclick="toggleDocumentStatus('${student.id}', '${escapeHtml(d.name)}', '${isR ? 'Pending' : 'Received'}')">
          ${isR ? '✓' : '✗'} ${escapeHtml(d.name)}
        </span>
      `;
    }).join(' ');

    const pct = student.docSummary.completionPercentage;
    const barColor = pct === 100 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';

    return `
      <tr>
        <td>
          <strong>${escapeHtml(student.studentName)}</strong>
          <div class="student-meta-sub"><code>${escapeHtml(student.rollNumber)}</code> · ${escapeHtml(student.course)}</div>
        </td>
        <td>${getCategoryBadge(student.category)}</td>
        <td>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${docBadges}
          </div>
        </td>
        <td style="min-width: 140px;">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px;">
            <span>${pct}%</span>
            <span class="text-xs text-muted">${student.docSummary.received}/${student.docSummary.total} files</span>
          </div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
          </div>
        </td>
        <td class="text-right">
          <button class="btn btn-sm btn-outline" onclick="openStudentProfileModal('${student.id}')">Review</button>
        </td>
      </tr>
    `;
  }).join('');
}

document.getElementById('doc-filter-compliance')?.addEventListener('change', renderDocumentsTracker);
document.getElementById('doc-filter-category')?.addEventListener('change', renderDocumentsTracker);

async function toggleDocumentStatus(studentId, documentName, nextStatus) {
  try {
    const updated = await apiFetch(`/api/students/${studentId}/documents`, {
      method: 'PATCH',
      body: JSON.stringify({ documentName, status: nextStatus })
    });

    showToast(`Document '${documentName}' marked as ${nextStatus}`, 'success');

    // Update in memory
    const idx = state.students.findIndex(s => s.id === studentId);
    if (idx !== -1) {
      state.students[idx] = updated;
    }

    // Refresh active views
    await loadAllData();

    // If profile modal is open for this student, re-render it
    if (state.selectedStudent && state.selectedStudent.id === studentId) {
      renderStudentProfileModal(updated);
    }
  } catch (err) {
    showToast(`Failed to update document: ${err.message}`, 'error');
  }
}

// ==========================================================================
// FEES VIEW & PAYMENT VERIFICATION
// ==========================================================================
function renderFeesView() {
  if (!state.stats) return;
  const { kpis } = state.stats;

  // KPI highlights
  document.getElementById('fee-total-assessed').textContent = `₹${kpis.totalFeeSum.toLocaleString('en-IN')}`;
  document.getElementById('fee-total-collected').textContent = `₹${kpis.totalPaidSum.toLocaleString('en-IN')}`;
  document.getElementById('fee-total-pending').textContent = `₹${kpis.totalPendingAmount.toLocaleString('en-IN')}`;
  document.getElementById('fee-unverified-count').textContent = kpis.unverifiedPayments;

  const tbody = document.getElementById('fees-table-tbody');
  const filter = document.getElementById('fee-table-filter')?.value || 'unverified';
  if (!tbody) return;

  let list = [...state.students];

  if (filter === 'unverified') {
    list = list.filter(s => s.paidFee >= s.totalFee && !s.paymentVerified);
  } else if (filter === 'partial') {
    list = list.filter(s => s.feeStatus === 'Partial');
  } else if (filter === 'unpaid') {
    list = list.filter(s => s.feeStatus === 'Unpaid');
  } else if (filter === 'paid-verified') {
    list = list.filter(s => s.paidFee >= s.totalFee && s.paymentVerified);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No student fee records match selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(student => {
    const isPaidInFull = student.paidFee >= student.totalFee && student.totalFee > 0;
    let verifyCol = '';

    if (isPaidInFull) {
      if (student.paymentVerified) {
        verifyCol = `<span class="badge badge-success">✓ Payment Verified</span>`;
      } else {
        verifyCol = `
          <button class="btn btn-sm btn-outline text-warning" onclick="verifyStudentPayment('${student.id}')" title="Verify physical receipt / gateway UTR">
            Verify Payment
          </button>
        `;
      }
    } else {
      verifyCol = `<span class="text-xs text-muted">Awaiting Full Payment</span>`;
    }

    return `
      <tr>
        <td>
          <strong>${escapeHtml(student.studentName)}</strong>
          <div class="student-meta-sub">${escapeHtml(student.course)}</div>
        </td>
        <td><code>${escapeHtml(student.rollNumber)}</code></td>
        <td>₹${student.totalFee.toLocaleString('en-IN')}</td>
        <td class="text-success font-semibold">₹${student.paidFee.toLocaleString('en-IN')}</td>
        <td class="${student.remainingFee > 0 ? 'text-danger font-semibold' : 'text-muted'}">
          ₹${student.remainingFee.toLocaleString('en-IN')}
        </td>
        <td>${getFeeStatusBadge(student)}</td>
        <td>${verifyCol}</td>
        <td class="text-right">
          <button class="btn btn-sm btn-outline" onclick="openStudentProfileModal('${student.id}')">Audit</button>
        </td>
      </tr>
    `;
  }).join('');
}

document.getElementById('fee-table-filter')?.addEventListener('change', renderFeesView);

async function verifyStudentPayment(studentId) {
  try {
    const updated = await apiFetch(`/api/students/${studentId}/verify-payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentVerified: true })
    });

    showToast(`Payment successfully verified for ${updated.studentName}!`, 'success');
    await loadAllData();

    if (state.selectedStudent && state.selectedStudent.id === studentId) {
      renderStudentProfileModal(updated);
    }
  } catch (err) {
    showToast(`Payment verification failed: ${err.message}`, 'error');
  }
}

// ==========================================================================
// SCHOLARSHIPS DESK
// ==========================================================================
function renderScholarshipsView() {
  const tbody = document.getElementById('scholarships-table-tbody');
  const filter = document.getElementById('scholarship-table-filter')?.value || 'Under Review';
  if (!tbody) return;

  let list = [...state.students];

  if (filter !== 'all') {
    list = list.filter(s => s.scholarshipStatus === filter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No scholarship cases found under filter '${filter}'.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(student => {
    return `
      <tr>
        <td>
          <strong>${escapeHtml(student.studentName)}</strong>
          <div class="student-meta-sub">${escapeHtml(student.academicYear || '')}</div>
        </td>
        <td><code>${escapeHtml(student.rollNumber)}</code></td>
        <td>${escapeHtml(student.course)}</td>
        <td>${getCategoryBadge(student.category)}</td>
        <td>₹${student.remainingFee.toLocaleString('en-IN')}</td>
        <td>${getScholarshipBadge(student.scholarshipStatus)}</td>
        <td class="text-right">
          <div class="action-btn-group">
            <button class="btn btn-sm btn-outline" onclick="updateScholarshipStatus('${student.id}', 'Under Review')">Review</button>
            <button class="btn btn-sm btn-success" onclick="updateScholarshipStatus('${student.id}', 'Approved')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="updateScholarshipStatus('${student.id}', 'Rejected')">Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

document.getElementById('scholarship-table-filter')?.addEventListener('change', renderScholarshipsView);

async function updateScholarshipStatus(studentId, newStatus) {
  try {
    const updated = await apiFetch(`/api/students/${studentId}/scholarship`, {
      method: 'PATCH',
      body: JSON.stringify({ scholarshipStatus: newStatus })
    });

    showToast(`Scholarship status set to '${newStatus}' for ${updated.studentName}`, 'success');
    await loadAllData();

    if (state.selectedStudent && state.selectedStudent.id === studentId) {
      renderStudentProfileModal(updated);
    }
  } catch (err) {
    showToast(`Scholarship update failed: ${err.message}`, 'error');
  }
}

// ==========================================================================
// STUDENT PROFILE MODAL
// ==========================================================================
function setupProfileModalActions() {
  const modal = document.getElementById('modal-student-profile');
  const closeBtns = modal?.querySelectorAll('[data-close-modal]');
  closeBtns?.forEach(btn => btn.addEventListener('click', () => {
    modal.style.display = 'none';
    state.selectedStudent = null;
  }));

  // Update scholarship in profile
  const saveScholarshipBtn = document.getElementById('btn-save-profile-scholarship');
  saveScholarshipBtn?.addEventListener('click', async () => {
    if (!state.selectedStudent) return;
    const newStatus = document.getElementById('profile-scholarship-select').value;
    await updateScholarshipStatus(state.selectedStudent.id, newStatus);
  });

  // Edit student from profile
  const editBtn = document.getElementById('btn-profile-edit-student');
  editBtn?.addEventListener('click', () => {
    if (!state.selectedStudent) return;
    const id = state.selectedStudent.id;
    modal.style.display = 'none';
    openStudentFormModal(id);
  });
}

async function openStudentProfileModal(studentId) {
  try {
    const student = await apiFetch(`/api/students/${studentId}`);
    state.selectedStudent = student;
    renderStudentProfileModal(student);

    const modal = document.getElementById('modal-student-profile');
    if (modal) modal.style.display = 'flex';
  } catch (err) {
    showToast(`Failed to load student profile: ${err.message}`, 'error');
  }
}

function renderStudentProfileModal(student) {
  // Initials
  const initials = student.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('modal-profile-avatar').textContent = initials;
  document.getElementById('modal-profile-name').textContent = student.studentName;
  document.getElementById('modal-profile-subtitle').textContent = `${student.rollNumber} · ${student.course}`;

  // Info
  document.getElementById('profile-roll').textContent = student.rollNumber;
  document.getElementById('profile-course').textContent = student.course;
  document.getElementById('profile-academic-year').textContent = student.academicYear;
  document.getElementById('profile-enrollment-year').textContent = student.enrollmentYear || '2024';
  document.getElementById('profile-category').innerHTML = getCategoryBadge(student.category);
  document.getElementById('profile-created').textContent = student.createdAt 
    ? new Date(student.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Registered';

  // Fee
  document.getElementById('profile-total-fee').textContent = `₹${student.totalFee.toLocaleString('en-IN')}`;
  document.getElementById('profile-paid-fee').textContent = `₹${student.paidFee.toLocaleString('en-IN')}`;
  document.getElementById('profile-remaining-fee').textContent = `₹${student.remainingFee.toLocaleString('en-IN')}`;
  document.getElementById('profile-fee-status-badge').innerHTML = getFeeStatusBadge(student);

  // Verification
  const verifyTextEl = document.getElementById('profile-verify-status-text');
  const verifyActionEl = document.getElementById('profile-verify-action-container');
  const isFullyPaid = student.paidFee >= student.totalFee && student.totalFee > 0;

  if (isFullyPaid) {
    if (student.paymentVerified) {
      verifyTextEl.innerHTML = `<strong>Payment Verified</strong> <span class="badge badge-success ml-2">Clearance Granted</span>`;
      verifyActionEl.innerHTML = '';
    } else {
      verifyTextEl.innerHTML = `<strong>Full Payment Recorded</strong> · <span class="text-warning">Challan / UTR Verification Pending</span>`;
      verifyActionEl.innerHTML = `
        <button class="btn btn-sm btn-primary" onclick="verifyStudentPayment('${student.id}')">
          Verify Payment Now
        </button>
      `;
    }
  } else {
    verifyTextEl.innerHTML = `<strong>Payment Outstanding</strong> · Clearance cannot be granted until full fee is paid`;
    verifyActionEl.innerHTML = '';
  }

  // Documents
  const { total, received, completionPercentage } = student.docSummary;
  document.getElementById('profile-doc-completion-badge').textContent = `Completion: ${completionPercentage}% (${received}/${total})`;
  const progFill = document.getElementById('profile-doc-progress-bar');
  if (progFill) progFill.style.width = `${completionPercentage}%`;

  const docContainer = document.getElementById('profile-doc-checklist');
  if (docContainer) {
    const docs = student.documents || [];
    docContainer.innerHTML = docs.map(doc => {
      const isR = doc.status === 'Received';
      return `
        <div class="interactive-doc-card" onclick="toggleDocumentStatus('${student.id}', '${escapeHtml(doc.name)}', '${isR ? 'Pending' : 'Received'}')">
          <div>
            <strong>${escapeHtml(doc.name)}</strong>
          </div>
          <span class="doc-status-pill ${isR ? 'received' : 'pending'}">
            ${isR ? '✓ Received' : '✗ Pending'}
          </span>
        </div>
      `;
    }).join('');
  }

  // Scholarship
  document.getElementById('profile-scholarship-badge').innerHTML = getScholarshipBadge(student.scholarshipStatus);
  const schSelect = document.getElementById('profile-scholarship-select');
  if (schSelect) schSelect.value = student.scholarshipStatus || 'Not Applied';
}

// ==========================================================================
// ADD / EDIT STUDENT MODAL
// ==========================================================================
function setupStudentFormModal() {
  const modal = document.getElementById('modal-student-form');
  const form = document.getElementById('student-edit-form');
  const closeBtns = modal?.querySelectorAll('[data-close-modal]');
  const catSelect = document.getElementById('form-category');
  const ruleText = document.getElementById('form-category-rule-text');

  closeBtns?.forEach(btn => btn.addEventListener('click', () => {
    modal.style.display = 'none';
  }));

  catSelect?.addEventListener('change', () => {
    const cat = catSelect.value;
    if (['SC', 'ST', 'OBC'].includes(cat)) {
      ruleText.textContent = `${cat} Category requires 6 documents: Admission, ID, Transcript, Fee Receipt, Category Certificate, and Income Certificate.`;
    } else {
      ruleText.textContent = `General Category requires 4 standard documents: Admission, ID, Transcript, and Fee Receipt.`;
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('form-student-id').value;
    const studentName = document.getElementById('form-student-name').value.trim();
    const rollNumber = document.getElementById('form-roll-number').value.trim();
    const course = document.getElementById('form-course').value;
    const academicYear = document.getElementById('form-academic-year').value;
    const enrollmentYear = Number(document.getElementById('form-enrollment-year').value);
    const category = document.getElementById('form-category').value;
    const totalFee = Number(document.getElementById('form-total-fee').value);
    const paidFee = Number(document.getElementById('form-paid-fee').value);
    const scholarshipStatus = document.getElementById('form-scholarship-status').value;

    if (!studentName || !rollNumber) {
      showToast('Student name and roll number are mandatory', 'error');
      return;
    }

    if (paidFee > totalFee) {
      showToast('Paid fee cannot be greater than total fee', 'error');
      return;
    }

    const payload = {
      studentName,
      rollNumber,
      course,
      academicYear,
      enrollmentYear,
      category,
      totalFee,
      paidFee,
      scholarshipStatus
    };

    try {
      if (id) {
        // UPDATE (PUT)
        const updated = await apiFetch(`/api/students/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Student updated successfully!', 'success');
      } else {
        // CREATE (POST)
        const created = await apiFetch('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Student added successfully!', 'success');
      }

      modal.style.display = 'none';
      await loadAllData();
    } catch (err) {
      showToast(`Unable to save student: ${err.message}`, 'error');
    }
  });
}

function openStudentFormModal(studentId = null) {
  const modal = document.getElementById('modal-student-form');
  const title = document.getElementById('form-modal-title');
  const sub = document.getElementById('form-modal-subtitle');
  const submitBtn = document.getElementById('form-submit-btn');
  const catSelect = document.getElementById('form-category');
  const ruleText = document.getElementById('form-category-rule-text');

  if (studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    title.textContent = 'Edit Student Record';
    sub.textContent = `Modify academic, financial, or quota data for ${student.studentName}`;
    submitBtn.textContent = 'Update Record';

    document.getElementById('form-student-id').value = student.id;
    document.getElementById('form-student-name').value = student.studentName;
    document.getElementById('form-roll-number').value = student.rollNumber;
    document.getElementById('form-course').value = student.course;
    document.getElementById('form-academic-year').value = student.academicYear;
    document.getElementById('form-enrollment-year').value = student.enrollmentYear || 2024;
    document.getElementById('form-category').value = student.category;
    document.getElementById('form-total-fee').value = student.totalFee;
    document.getElementById('form-paid-fee').value = student.paidFee;
    document.getElementById('form-scholarship-status').value = student.scholarshipStatus || 'Not Applied';
  } else {
    title.textContent = 'Add New Student';
    sub.textContent = 'Register student in administrative database';
    submitBtn.textContent = 'Save Student';

    document.getElementById('form-student-id').value = '';
    document.getElementById('form-student-name').value = '';
    document.getElementById('form-roll-number').value = '';
    document.getElementById('form-course').value = 'B.Tech Computer Science';
    document.getElementById('form-academic-year').value = '1st Year';
    document.getElementById('form-enrollment-year').value = new Date().getFullYear();
    document.getElementById('form-category').value = 'General';
    document.getElementById('form-total-fee').value = 85000;
    document.getElementById('form-paid-fee').value = 0;
    document.getElementById('form-scholarship-status').value = 'Not Applied';
  }

  // Trigger category rule update
  if (catSelect && ruleText) {
    const cat = catSelect.value;
    if (['SC', 'ST', 'OBC'].includes(cat)) {
      ruleText.textContent = `${cat} Category requires 6 documents: Admission, ID, Transcript, Fee Receipt, Category Certificate, and Income Certificate.`;
    } else {
      ruleText.textContent = `General Category requires 4 standard documents: Admission, ID, Transcript, and Fee Receipt.`;
    }
  }

  modal.style.display = 'flex';
}

// ==========================================================================
// DELETE CONFIRMATION MODAL
// ==========================================================================
function setupDeleteModal() {
  const modal = document.getElementById('modal-delete-confirm');
  const closeBtns = modal?.querySelectorAll('[data-close-modal]');
  const confirmBtn = document.getElementById('btn-confirm-delete');

  closeBtns?.forEach(btn => btn.addEventListener('click', () => {
    modal.style.display = 'none';
    state.deleteTargetStudent = null;
  }));

  confirmBtn?.addEventListener('click', async () => {
    if (!state.deleteTargetStudent) return;
    const target = state.deleteTargetStudent;

    try {
      await apiFetch(`/api/students/${target.id}`, { method: 'DELETE' });
      showToast(`Student ${target.studentName} deleted successfully`, 'success');
      modal.style.display = 'none';
      state.deleteTargetStudent = null;
      await loadAllData();
    } catch (err) {
      showToast(`Failed to delete student: ${err.message}`, 'error');
    }
  });
}

function openDeleteConfirmModal(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  state.deleteTargetStudent = student;
  const preview = document.getElementById('delete-target-preview');
  if (preview) {
    preview.innerHTML = `
      <strong>${escapeHtml(student.studentName)}</strong><br>
      Roll No: <code>${escapeHtml(student.rollNumber)}</code><br>
      Course: ${escapeHtml(student.course)}
    `;
  }

  const modal = document.getElementById('modal-delete-confirm');
  if (modal) modal.style.display = 'flex';
}

// ==========================================================================
// SETTINGS ACTIONS
// ==========================================================================
function setupSettingsActions() {
  const refreshBtn = document.getElementById('btn-refresh-cache');
  refreshBtn?.addEventListener('click', async () => {
    await loadAllData();
    showToast('Cache refreshed and analytics synchronized with backend', 'info');
  });
}

// ==========================================================================
// GLOBAL SHORTCUTS & HELPERS
// ==========================================================================
function setupGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
    }
  });
}

function getCategoryBadge(category) {
  const c = category || 'General';
  const classes = {
    General: 'badge-primary',
    SC: 'badge-success',
    ST: 'badge-warning',
    OBC: 'badge-purple'
  };
  return `<span class="badge ${classes[c] || 'badge-primary'}">${escapeHtml(c)}</span>`;
}

function getFeeStatusBadge(student) {
  const status = student.feeStatus || 'Unpaid';
  const isVerified = student.paymentVerified;

  if (status === 'Paid') {
    if (isVerified) {
      return `<span class="badge badge-paid">Paid · Verified</span>`;
    }
    return `
      <span class="badge badge-paid" title="Payment awaiting desk verification">
        Paid · Verify
      </span>
    `;
  } else if (status === 'Partial') {
    return `
      <span class="badge badge-partial" title="Pending: ₹${student.remainingFee.toLocaleString('en-IN')}">
        Partial (₹${student.remainingFee.toLocaleString('en-IN')})
      </span>
    `;
  } else {
    return `<span class="badge badge-unpaid">Unpaid</span>`;
  }
}

function getDocumentSummaryBadge(student) {
  const { total, received, completionPercentage } = student.docSummary;
  const isComplete = completionPercentage === 100;
  const badgeClass = isComplete ? 'badge-success' : completionPercentage >= 50 ? 'badge-warning' : 'badge-danger';
  return `<span class="badge ${badgeClass}">${received}/${total} (${completionPercentage}%)</span>`;
}

function getScholarshipBadge(status) {
  const s = status || 'Not Applied';
  const classes = {
    'Approved': 'badge-success',
    'Under Review': 'badge-warning',
    'Applied': 'badge-info',
    'Rejected': 'badge-danger',
    'Not Applied': 'badge-primary'
  };
  return `<span class="badge ${classes[s] || 'badge-primary'}">${escapeHtml(s)}</span>`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn?.addEventListener('click', () => toast.remove());

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
