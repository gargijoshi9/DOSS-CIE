const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server');

let server;
let baseUrl;
let createdStudentId = null;

before(async () => {
  await new Promise((resolve) => {
    // Listen on ephemeral port (0) on localhost
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('Health & Metrics Endpoint Tests', () => {
  test('1. GET /health returns status 200', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
  });

  test('2. GET /health returns healthy status and metadata', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'healthy');
    assert.ok(body.application.includes('College Student Administration Portal'));
    assert.ok(typeof body.uptimeSeconds === 'number');
    assert.ok(body.timestamp);
  });

  test('3. GET /metrics returns Prometheus metrics in text format', async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('college_total_students'));
    assert.ok(text.includes('http_requests_total'));
  });
});

describe('Student REST API Tests', () => {
  test('4. GET /api/students returns an array of students', async () => {
    const res = await fetch(`${baseUrl}/api/students`);
    assert.equal(res.status, 200);
    const students = await res.json();
    assert.ok(Array.isArray(students));
    assert.ok(students.length > 0, 'Should have initial sample students');

    const first = students[0];
    assert.ok(first.id);
    assert.ok(first.studentName);
    assert.ok(first.rollNumber);
    assert.ok(first.feeStatus);
    assert.ok(typeof first.remainingFee === 'number');
    assert.ok(Array.isArray(first.documents));
  });

  test('5. GET /api/students/:id returns specific student details', async () => {
    // First get all to find a valid id
    const listRes = await fetch(`${baseUrl}/api/students`);
    const students = await listRes.json();
    const target = students[0];

    const res = await fetch(`${baseUrl}/api/students/${target.id}`);
    assert.equal(res.status, 200);
    const student = await res.json();
    assert.equal(student.id, target.id);
    assert.equal(student.rollNumber, target.rollNumber);
  });

  test('6. GET /api/students/:id with invalid ID returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/students/non-existent-student-id-9999`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
    assert.ok(body.error.includes('not found'));
  });

  test('7. POST /api/students validates missing required fields and returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: '' // Missing other fields
      })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Validation failed');
    assert.ok(Array.isArray(body.details));
  });

  test('8. POST /api/students creates a new student with category-specific documents (CRUD - Create)', async () => {
    const testRoll = `TEST-${Date.now().toString().slice(-6)}`;
    const payload = {
      studentName: 'Test Student Automation',
      rollNumber: testRoll,
      course: 'B.Tech Computer Science',
      academicYear: '1st Year',
      enrollmentYear: 2026,
      category: 'OBC', // Requires 6 documents
      totalFee: 80000,
      paidFee: 40000,
      scholarshipStatus: 'Applied'
    };

    const res = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const created = await res.json();
    assert.ok(created.id);
    createdStudentId = created.id;
    assert.equal(created.studentName, payload.studentName);
    assert.equal(created.rollNumber, testRoll);
    assert.equal(created.feeStatus, 'Partial');
    assert.equal(created.remainingFee, 40000);
    
    // Check OBC document list has 6 items including category & income certificates
    assert.equal(created.documents.length, 6);
    const docNames = created.documents.map(d => d.name);
    assert.ok(docNames.includes('Category Certificate'));
    assert.ok(docNames.includes('Income Certificate'));
  });

  test('9. PUT /api/students/:id updates student information (CRUD - Update)', async () => {
    assert.ok(createdStudentId, 'createdStudentId must exist from previous test');

    const updatePayload = {
      studentName: 'Test Student Automation (Updated)',
      course: 'B.Tech Data Science',
      paidFee: 80000 // Full payment
    };

    const res = await fetch(`${baseUrl}/api/students/${createdStudentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.studentName, 'Test Student Automation (Updated)');
    assert.equal(updated.course, 'B.Tech Data Science');
    assert.equal(updated.paidFee, 80000);
    assert.equal(updated.feeStatus, 'Paid');
    assert.equal(updated.remainingFee, 0);
  });

  test('10. PATCH /api/students/:id/verify-payment verifies payment for fully paid student', async () => {
    assert.ok(createdStudentId);

    const res = await fetch(`${baseUrl}/api/students/${createdStudentId}/verify-payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentVerified: true })
    });

    assert.equal(res.status, 200);
    const verified = await res.json();
    assert.equal(verified.paymentVerified, true);
  });

  test('11. PATCH /api/students/:id/documents toggles document status', async () => {
    assert.ok(createdStudentId);

    const res = await fetch(`${baseUrl}/api/students/${createdStudentId}/documents`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentName: 'Admission Form',
        status: 'Received'
      })
    });

    assert.equal(res.status, 200);
    const updated = await res.json();
    const doc = updated.documents.find(d => d.name === 'Admission Form');
    assert.equal(doc.status, 'Received');
  });

  test('12. PATCH /api/students/:id/scholarship updates scholarship status', async () => {
    assert.ok(createdStudentId);

    const res = await fetch(`${baseUrl}/api/students/${createdStudentId}/scholarship`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scholarshipStatus: 'Approved' })
    });

    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.scholarshipStatus, 'Approved');
  });

  test('13. DELETE /api/students/:id deletes student (CRUD - Delete)', async () => {
    assert.ok(createdStudentId);

    const res = await fetch(`${baseUrl}/api/students/${createdStudentId}`, {
      method: 'DELETE'
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.message, 'Student deleted successfully');

    // Confirm it no longer exists
    const checkRes = await fetch(`${baseUrl}/api/students/${createdStudentId}`);
    assert.equal(checkRes.status, 404);
  });

  test('14. GET /api/stats returns comprehensive analytics', async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    assert.equal(res.status, 200);
    const stats = await res.json();
    assert.ok(stats.kpis);
    assert.ok(typeof stats.kpis.totalStudents === 'number');
    assert.ok(typeof stats.kpis.pendingFeeCount === 'number');
    assert.ok(typeof stats.kpis.activeScholarships === 'number');
    assert.ok(typeof stats.kpis.missingDocumentsCount === 'number');
    assert.ok(stats.categoryDistribution);
    assert.ok(stats.feeDistribution);
    assert.ok(stats.actionRequired);
  });
});
