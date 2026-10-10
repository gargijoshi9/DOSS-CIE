const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'students.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

// ==========================================
// PROMETHEUS METRICS SETUP
// ==========================================
const register = new client.Registry();

// Add default system metrics (cpu, memory, event loop, etc.)
client.collectDefaultMetrics({ register, prefix: 'college_portal_' });

// Custom Prometheus Metrics
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register]
});

const totalStudentsGauge = new client.Gauge({
  name: 'college_total_students',
  help: 'Total registered students in the portal',
  registers: [register]
});

const pendingFeesGauge = new client.Gauge({
  name: 'college_pending_fees_count',
  help: 'Count of students with pending or partial fees',
  registers: [register]
});

const missingDocumentsGauge = new client.Gauge({
  name: 'college_missing_documents_count',
  help: 'Count of students with missing or pending compliance documents',
  registers: [register]
});

const activeScholarshipsGauge = new client.Gauge({
  name: 'college_active_scholarships_count',
  help: 'Count of scholarship cases currently applied or under review',
  registers: [register]
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging & metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    
    // Track Prometheus metrics (exclude metrics endpoint to avoid skew)
    if (req.path !== '/metrics') {
      httpRequestCounter.inc({ method: req.method, route, status: res.statusCode });
      httpRequestDuration.observe({ method: req.method, route, status: res.statusCode }, duration);
    }
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${(duration * 1000).toFixed(1)}ms`);
  });
  next();
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================
const STANDARD_DOCUMENTS_GENERAL = [
  'Admission Form',
  'ID Card',
  'Academic Transcript',
  'Fee Receipt'
];

const STANDARD_DOCUMENTS_RESERVED = [
  'Admission Form',
  'ID Card',
  'Academic Transcript',
  'Fee Receipt',
  'Category Certificate',
  'Income Certificate'
];

function getRequiredDocumentNames(category) {
  const isReserved = ['SC', 'ST', 'OBC'].includes((category || '').toUpperCase());
  return isReserved ? STANDARD_DOCUMENTS_RESERVED : STANDARD_DOCUMENTS_GENERAL;
}

function buildStudentDocuments(category, existingDocs = []) {
  const required = getRequiredDocumentNames(category);
  const existingMap = new Map();
  if (Array.isArray(existingDocs)) {
    existingDocs.forEach(d => {
      if (d && d.name) {
        existingMap.set(d.name, d.status === 'Received' ? 'Received' : 'Pending');
      }
    });
  }

  return required.map(docName => ({
    name: docName,
    status: existingMap.has(docName) ? existingMap.get(docName) : 'Pending'
  }));
}

function calculateStudentFinancials(student) {
  const total = Number(student.totalFee) || 0;
  const paid = Number(student.paidFee) || 0;
  const remainingFee = Math.max(0, total - paid);

  let feeStatus = 'Unpaid';
  if (paid >= total && total > 0) {
    feeStatus = 'Paid';
  } else if (paid > 0 && paid < total) {
    feeStatus = 'Partial';
  } else if (total === 0) {
    feeStatus = 'Paid';
  }

  // Calculate document compliance
  const docs = student.documents || [];
  const totalDocs = docs.length;
  const receivedDocs = docs.filter(d => d.status === 'Received').length;
  const pendingDocs = totalDocs - receivedDocs;
  const completionPercentage = totalDocs > 0 ? Math.round((receivedDocs / totalDocs) * 100) : 100;

  return {
    ...student,
    totalFee: total,
    paidFee: paid,
    remainingFee,
    feeStatus,
    paymentVerified: Boolean(student.paymentVerified),
    docSummary: {
      total: totalDocs,
      received: receivedDocs,
      pending: pendingDocs,
      completionPercentage
    }
  };
}

function readStudentsData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const students = JSON.parse(raw);
    return Array.isArray(students) ? students : [];
  } catch (err) {
    console.error('Error reading students.json:', err.message);
    return [];
  }
}

function writeStudentsData(students) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(students, null, 2), 'utf8');
    updatePrometheusGauges(students);
    return true;
  } catch (err) {
    console.error('Error writing to students.json:', err.message);
    return false;
  }
}

function updatePrometheusGauges(studentsList) {
  const students = studentsList || readStudentsData();
  const calculated = students.map(calculateStudentFinancials);
  
  totalStudentsGauge.set(calculated.length);
  
  const pendingFees = calculated.filter(s => s.feeStatus !== 'Paid').length;
  pendingFeesGauge.set(pendingFees);
  
  const missingDocs = calculated.filter(s => s.docSummary.pending > 0).length;
  missingDocumentsGauge.set(missingDocs);
  
  const activeScholarships = calculated.filter(s => 
    s.scholarshipStatus === 'Applied' || s.scholarshipStatus === 'Under Review'
  ).length;
  activeScholarshipsGauge.set(activeScholarships);
}

// Initial gauge calculation on startup
updatePrometheusGauges();

// ==========================================
// HEALTH & METRICS ENDPOINTS
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    application: 'College Student Administration Portal v2.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/metrics', async (req, res) => {
  try {
    updatePrometheusGauges();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

// GET /api/stats - Dashboard analytics and aggregated KPIs
app.get('/api/stats', (req, res) => {
  const students = readStudentsData().map(calculateStudentFinancials);
  
  const totalStudents = students.length;
  const pendingFeeStudents = students.filter(s => s.feeStatus !== 'Paid').length;
  const activeScholarships = students.filter(s => 
    s.scholarshipStatus === 'Applied' || s.scholarshipStatus === 'Under Review'
  ).length;
  const missingDocumentStudents = students.filter(s => s.docSummary.pending > 0).length;
  const unverifiedPayments = students.filter(s => s.paidFee >= s.totalFee && !s.paymentVerified).length;
  
  const totalFeeSum = students.reduce((sum, s) => sum + s.totalFee, 0);
  const totalPaidSum = students.reduce((sum, s) => sum + s.paidFee, 0);
  const totalPendingAmount = students.reduce((sum, s) => sum + s.remainingFee, 0);

  // Category distribution
  const categories = { General: 0, SC: 0, ST: 0, OBC: 0 };
  students.forEach(s => {
    const cat = s.category || 'General';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // Fee distribution
  const feeDistribution = { Paid: 0, Partial: 0, Unpaid: 0 };
  students.forEach(s => {
    feeDistribution[s.feeStatus] = (feeDistribution[s.feeStatus] || 0) + 1;
  });

  // Scholarship distribution
  const scholarshipDistribution = {
    'Not Applied': 0,
    'Applied': 0,
    'Under Review': 0,
    'Approved': 0,
    'Rejected': 0
  };
  students.forEach(s => {
    const status = s.scholarshipStatus || 'Not Applied';
    scholarshipDistribution[status] = (scholarshipDistribution[status] || 0) + 1;
  });

  // Recent admissions (sort by createdAt or id descending, top 5)
  const recentAdmissions = [...students]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  // Action required items
  const actionRequired = {
    unverifiedPaymentsCount: unverifiedPayments,
    missingDocumentsCount: missingDocumentStudents,
    partialFeeCount: students.filter(s => s.feeStatus === 'Partial').length,
    scholarshipsUnderReviewCount: students.filter(s => s.scholarshipStatus === 'Under Review').length
  };

  res.json({
    kpis: {
      totalStudents,
      pendingFeeCount: pendingFeeStudents,
      activeScholarships,
      missingDocumentsCount: missingDocumentStudents,
      totalFeeSum,
      totalPaidSum,
      totalPendingAmount,
      unverifiedPayments
    },
    categoryDistribution: categories,
    feeDistribution,
    scholarshipDistribution,
    actionRequired,
    recentAdmissions
  });
});

// GET /api/students - List all students with search & filters
app.get('/api/students', (req, res) => {
  let students = readStudentsData().map(calculateStudentFinancials);
  const { search, category, feeStatus, scholarshipStatus, sort } = req.query;

  // Search filter
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    students = students.filter(s => 
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
      (s.course && s.course.toLowerCase().includes(q))
    );
  }

  // Category filter
  if (category && category !== 'All') {
    students = students.filter(s => s.category === category);
  }

  // Fee Status filter
  if (feeStatus && feeStatus !== 'All') {
    students = students.filter(s => s.feeStatus === feeStatus);
  }

  // Scholarship filter
  if (scholarshipStatus && scholarshipStatus !== 'All') {
    students = students.filter(s => s.scholarshipStatus === scholarshipStatus);
  }

  // Sorting
  if (sort === 'name-asc') {
    students.sort((a, b) => a.studentName.localeCompare(b.studentName));
  } else if (sort === 'name-desc') {
    students.sort((a, b) => b.studentName.localeCompare(a.studentName));
  } else if (sort === 'roll-asc') {
    students.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
  } else if (sort === 'fee-desc') {
    students.sort((a, b) => b.remainingFee - a.remainingFee);
  } else {
    // Default newest first
    students.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  res.json(students);
});

// GET /api/students/:id - Get single student
app.get('/api/students/:id', (req, res) => {
  const students = readStudentsData();
  const student = students.find(s => s.id === req.params.id);

  if (!student) {
    return res.status(404).json({ error: `Student with ID '${req.params.id}' not found` });
  }

  res.json(calculateStudentFinancials(student));
});

// POST /api/students - Create new student
app.post('/api/students', (req, res) => {
  const {
    studentName,
    rollNumber,
    course,
    academicYear,
    enrollmentYear,
    category,
    totalFee,
    paidFee,
    scholarshipStatus,
    documents
  } = req.body;

  // Validation
  const errors = [];
  if (!studentName || !studentName.trim()) errors.push('Student Name is required');
  if (!rollNumber || !rollNumber.trim()) errors.push('Roll Number is required');
  if (!course || !course.trim()) errors.push('Course is required');
  if (!academicYear || !academicYear.trim()) errors.push('Academic Year is required');
  
  const validCategories = ['General', 'SC', 'ST', 'OBC'];
  if (!category || !validCategories.includes(category)) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}`);
  }

  const validScholarshipStatuses = ['Not Applied', 'Applied', 'Under Review', 'Approved', 'Rejected'];
  if (scholarshipStatus && !validScholarshipStatuses.includes(scholarshipStatus)) {
    errors.push(`Scholarship status must be one of: ${validScholarshipStatuses.join(', ')}`);
  }

  const numTotalFee = Number(totalFee);
  const numPaidFee = Number(paidFee);

  if (isNaN(numTotalFee) || numTotalFee < 0) {
    errors.push('Total Fee must be a valid non-negative number');
  }
  if (isNaN(numPaidFee) || numPaidFee < 0) {
    errors.push('Paid Fee must be a valid non-negative number');
  }
  if (!isNaN(numTotalFee) && !isNaN(numPaidFee) && numPaidFee > numTotalFee) {
    errors.push('Paid Fee cannot exceed Total Fee');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const students = readStudentsData();

  // Check duplicate roll number
  const existingWithRoll = students.find(s => 
    s.rollNumber.trim().toLowerCase() === rollNumber.trim().toLowerCase()
  );
  if (existingWithRoll) {
    return res.status(400).json({ error: `Roll Number '${rollNumber}' is already registered` });
  }

  // Construct document checklist according to category
  const formattedDocs = buildStudentDocuments(category, documents || []);

  const newStudent = {
    id: `std-${uuidv4().substring(0, 8)}`,
    studentName: studentName.trim(),
    rollNumber: rollNumber.trim().toUpperCase(),
    course: course.trim(),
    academicYear: academicYear.trim(),
    enrollmentYear: Number(enrollmentYear) || new Date().getFullYear(),
    category: category,
    totalFee: numTotalFee,
    paidFee: numPaidFee,
    paymentVerified: numPaidFee >= numTotalFee && numTotalFee > 0 ? Boolean(req.body.paymentVerified) : false,
    scholarshipStatus: scholarshipStatus || 'Not Applied',
    documents: formattedDocs,
    createdAt: new Date().toISOString()
  };

  students.push(newStudent);
  if (!writeStudentsData(students)) {
    return res.status(500).json({ error: 'Failed to persist student record' });
  }

  console.log(`[CRUD] Student created: ${newStudent.studentName} (${newStudent.rollNumber})`);
  res.status(201).json(calculateStudentFinancials(newStudent));
});

// PUT /api/students/:id - Update student
app.put('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const students = readStudentsData();
  const index = students.findIndex(s => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `Student with ID '${id}' not found` });
  }

  const existing = students[index];
  const {
    studentName,
    rollNumber,
    course,
    academicYear,
    enrollmentYear,
    category,
    totalFee,
    paidFee,
    paymentVerified,
    scholarshipStatus,
    documents
  } = req.body;

  // Validation
  const errors = [];
  if (studentName !== undefined && !studentName.trim()) errors.push('Student Name cannot be empty');
  if (rollNumber !== undefined && !rollNumber.trim()) errors.push('Roll Number cannot be empty');
  if (course !== undefined && !course.trim()) errors.push('Course cannot be empty');
  if (academicYear !== undefined && !academicYear.trim()) errors.push('Academic Year cannot be empty');

  const validCategories = ['General', 'SC', 'ST', 'OBC'];
  const targetCategory = category !== undefined ? category : existing.category;
  if (!validCategories.includes(targetCategory)) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}`);
  }

  const validScholarshipStatuses = ['Not Applied', 'Applied', 'Under Review', 'Approved', 'Rejected'];
  const targetScholarship = scholarshipStatus !== undefined ? scholarshipStatus : existing.scholarshipStatus;
  if (!validScholarshipStatuses.includes(targetScholarship)) {
    errors.push(`Scholarship status must be one of: ${validScholarshipStatuses.join(', ')}`);
  }

  const numTotal = totalFee !== undefined ? Number(totalFee) : existing.totalFee;
  const numPaid = paidFee !== undefined ? Number(paidFee) : existing.paidFee;

  if (isNaN(numTotal) || numTotal < 0) errors.push('Total Fee must be a non-negative number');
  if (isNaN(numPaid) || numPaid < 0) errors.push('Paid Fee must be a non-negative number');
  if (!isNaN(numTotal) && !isNaN(numPaid) && numPaid > numTotal) {
    errors.push('Paid Fee cannot exceed Total Fee');
  }

  // Check duplicate roll number if changing
  if (rollNumber && rollNumber.trim().toUpperCase() !== existing.rollNumber) {
    const duplicate = students.find(s => 
      s.id !== id && s.rollNumber.trim().toLowerCase() === rollNumber.trim().toLowerCase()
    );
    if (duplicate) {
      errors.push(`Roll Number '${rollNumber}' is already used by another student`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  // Re-evaluate documents based on new category
  const sourceDocs = documents !== undefined ? documents : existing.documents;
  const updatedDocs = buildStudentDocuments(targetCategory, sourceDocs);

  // If paidFee is less than totalFee, paymentVerified should reset to false
  const updatedPaymentVerified = numPaid >= numTotal && numTotal > 0
    ? (paymentVerified !== undefined ? Boolean(paymentVerified) : existing.paymentVerified)
    : false;

  const updatedStudent = {
    ...existing,
    studentName: studentName !== undefined ? studentName.trim() : existing.studentName,
    rollNumber: rollNumber !== undefined ? rollNumber.trim().toUpperCase() : existing.rollNumber,
    course: course !== undefined ? course.trim() : existing.course,
    academicYear: academicYear !== undefined ? academicYear.trim() : existing.academicYear,
    enrollmentYear: enrollmentYear !== undefined ? Number(enrollmentYear) : existing.enrollmentYear,
    category: targetCategory,
    totalFee: numTotal,
    paidFee: numPaid,
    paymentVerified: updatedPaymentVerified,
    scholarshipStatus: targetScholarship,
    documents: updatedDocs,
    updatedAt: new Date().toISOString()
  };

  students[index] = updatedStudent;
  if (!writeStudentsData(students)) {
    return res.status(500).json({ error: 'Failed to update student record' });
  }

  console.log(`[CRUD] Student updated: ${updatedStudent.studentName} (${updatedStudent.id})`);
  res.json(calculateStudentFinancials(updatedStudent));
});

// DELETE /api/students/:id - Delete student
app.delete('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const students = readStudentsData();
  const index = students.findIndex(s => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `Student with ID '${id}' not found` });
  }

  const [deleted] = students.splice(index, 1);
  if (!writeStudentsData(students)) {
    return res.status(500).json({ error: 'Failed to delete student record' });
  }

  console.log(`[CRUD] Student deleted: ${deleted.studentName} (${deleted.rollNumber})`);
  res.json({ message: 'Student deleted successfully', student: deleted });
});

// PATCH /api/students/:id/documents - Toggle or set document status
app.patch('/api/students/:id/documents', (req, res) => {
  const { id } = req.params;
  const { documentName, status } = req.body;

  if (!documentName) {
    return res.status(400).json({ error: 'documentName is required' });
  }

  const validStatuses = ['Received', 'Pending'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'status must be "Received" or "Pending"' });
  }

  const students = readStudentsData();
  const student = students.find(s => s.id === id);

  if (!student) {
    return res.status(404).json({ error: `Student with ID '${id}' not found` });
  }

  let docFound = false;
  student.documents = (student.documents || []).map(doc => {
    if (doc.name === documentName) {
      docFound = true;
      const newStatus = status ? status : (doc.status === 'Received' ? 'Pending' : 'Received');
      return { ...doc, status: newStatus };
    }
    return doc;
  });

  if (!docFound) {
    return res.status(404).json({ error: `Document '${documentName}' not found for this student` });
  }

  student.updatedAt = new Date().toISOString();
  writeStudentsData(students);

  console.log(`[DOCS] Document '${documentName}' toggled for ${student.studentName}`);
  res.json(calculateStudentFinancials(student));
});

// PATCH /api/students/:id/verify-payment - Verify or unverify payment
app.patch('/api/students/:id/verify-payment', (req, res) => {
  const { id } = req.params;
  const { paymentVerified } = req.body;

  const students = readStudentsData();
  const student = students.find(s => s.id === id);

  if (!student) {
    return res.status(404).json({ error: `Student with ID '${id}' not found` });
  }

  if (student.paidFee < student.totalFee) {
    return res.status(400).json({ 
      error: 'Cannot verify payment while remaining fee is unpaid. Full payment required.' 
    });
  }

  student.paymentVerified = paymentVerified !== undefined ? Boolean(paymentVerified) : true;
  student.updatedAt = new Date().toISOString();
  writeStudentsData(students);

  console.log(`[FEE] Payment verification set to ${student.paymentVerified} for ${student.studentName}`);
  res.json(calculateStudentFinancials(student));
});

// PATCH /api/students/:id/scholarship - Update scholarship status
app.patch('/api/students/:id/scholarship', (req, res) => {
  const { id } = req.params;
  const { scholarshipStatus } = req.body;

  const validScholarshipStatuses = ['Not Applied', 'Applied', 'Under Review', 'Approved', 'Rejected'];
  if (!scholarshipStatus || !validScholarshipStatuses.includes(scholarshipStatus)) {
    return res.status(400).json({ 
      error: `scholarshipStatus must be one of: ${validScholarshipStatuses.join(', ')}` 
    });
  }

  const students = readStudentsData();
  const student = students.find(s => s.id === id);

  if (!student) {
    return res.status(404).json({ error: `Student with ID '${id}' not found` });
  }

  student.scholarshipStatus = scholarshipStatus;
  student.updatedAt = new Date().toISOString();
  writeStudentsData(students);

  console.log(`[SCHOLARSHIP] Status updated to '${scholarshipStatus}' for ${student.studentName}`);
  res.json(calculateStudentFinancials(student));
});

// ==========================================
// CENTRAL ERROR HANDLER & 404
// ==========================================
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route '${req.originalUrl}' not found` });
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('==================================================');
    console.log(`COLLEGE STUDENT ADMINISTRATION PORTAL v2.0`);
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Metrics:      http://localhost:${PORT}/metrics`);
    console.log('==================================================');
  });
}

module.exports = app;
