# College Student Administration Portal v2.0

A production-ready Academic Administration Dashboard designed for college administration desks to manage student admissions, document compliance, fee reconciliation, scholarships, and master academic records.

This application is built with a minimalist, robust Node.js/Express stack and is structured as the foundational application for the DevOps Continuous Integration & Deployment (CI/CD) pipeline:
**Git &rarr; GitHub &rarr; Jenkins CI/CD &rarr; Docker &rarr; Kubernetes &rarr; Prometheus &rarr; Grafana**.

---

## 🌟 Key Features

### 1. Central Administration Dashboard
- **Dynamic KPIs**: Real-time calculations for Total Enrolled Students, Pending Fees count, Outstanding Amount (₹), Active Scholarships, and Missing Document files.
- **Demographic Distribution**: Visual breakdown of categories (General, SC, ST, OBC).
- **Fee Distribution**: Live breakdown of Paid, Partial, and Unpaid accounts.
- **Action Required Alerts**: Immediate desk alerts for unverified payments, missing compliance files, installment dues, and applications under review.
- **Recent Admissions Feed**: Instant overview of newly enrolled candidates.

### 2. Complete Student Record Management (CRUD)
- **Create**: Register new student admissions with dynamic quota document requirements and instant fee preview.
- **Read**: Search, filter, sort, and view comprehensive student dossier profiles.
- **Update**: Edit academic details, quota categories, payment amounts, and scholarship status with form validation.
- **Delete**: Remove student records with confirmation modal safety.

### 3. Category-Based Document Compliance Tracker
- **General Category**: 4 standard mandatory files (`Admission Form`, `ID Card`, `Academic Transcript`, `Fee Receipt`).
- **SC / ST / OBC Categories**: 6 mandatory files (Standard 4 + `Category Certificate` + `Income Certificate`).
- **Interactive Checklist**: Administrators can toggle document status (`✓ Received` &harr; `✗ Pending`) directly from the table or profile modal.
- **Compliance Rate**: Real-time completion percentage calculated for each student.

### 4. Fee Management & Payment Verification
- **Remaining Fee Calculation**: Automatically computed as `totalFee - paidFee`.
- **Status Classification**: `Paid` (when paid &ge; total), `Partial` (when paid > 0 and < total), or `Unpaid` (when paid = 0).
- **Verification Workflow**: Decoupled from payment entry. Administrators click `Verify Payment` upon validating physical bank receipts or gateway UTR numbers, persisting `paymentVerified: true`.

### 5. Scholarship Administration Desk
- Tracks application states: `Not Applied`, `Applied`, `Under Review`, `Approved`, `Rejected`.
- Quick audit and decision buttons (`Under Review`, `Approve`, `Reject`) with real-time backend updates.

### 6. DevOps Observability & Metrics
- **Health Check (`/health`)**: Returns JSON health status, application metadata, uptime, and timestamp for Docker/Kubernetes liveness and readiness probes.
- **Prometheus Metrics (`/metrics`)**: Exposes native metrics using `prom-client` including HTTP request counts, request latency histograms, process metrics, and custom business gauges (`college_total_students`, `college_pending_fees_count`, `college_missing_documents_count`, `college_active_scholarships_count`).

---

## 🛠 Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Semantic HTML5, Vanilla CSS3 (Custom Design System, Inter font), Vanilla JavaScript (ES6+ Fetch API)
- **Data Persistence**: JSON File Storage (`data/students.json`)
- **Metrics & Observability**: `prom-client` (Prometheus exposition format)
- **Testing**: Node.js built-in test runner (`node:test`, `node:assert`)

---

## 📁 Project Structure

```text
college-student-portal/
├── public/
│   ├── index.html        # Main single-page administrative dashboard
│   ├── css/
│   │   └── styles.css    # Professional academic administration styling
│   └── js/
│       └── app.js        # Client-side state, modal controllers & API fetch logic
│
├── data/
│   └── students.json     # JSON datastore preloaded with 18 varied student records
│
├── tests/
│   └── api.test.js       # 14 automated tests for health, metrics & student CRUD APIs
│
├── server.js             # Express application, REST endpoints, metrics & logging
├── package.json          # Project scripts and dependencies
├── .gitignore            # Git exclusion rules
└── README.md             # Documentation
```

---

## 🚀 Running Locally

### Quick Setup

```bash
npm install
npm test
npm start
```

Once started, access the application and operational endpoints:
- **Application**: [http://localhost:3000](http://localhost:3000)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **Prometheus Metrics**: [http://localhost:3000/metrics](http://localhost:3000/metrics)

---

## 🧪 Running Automated Tests

Run the built-in test suite (ideal for Jenkins CI pipeline execution):
```bash
npm test
```

The test runner validates:
1. `GET /health` returns 200 and healthy metadata
2. `GET /metrics` returns Prometheus text metrics
3. `GET /api/students` returns student list with computed financials
4. `GET /api/students/:id` retrieves single student
5. `GET /api/students/:invalidId` returns 404
6. `POST /api/students` validation error handling (400)
7. `POST /api/students` student creation with category document expansion (201)
8. `PUT /api/students/:id` student updates (200)
9. `PATCH /api/students/:id/verify-payment` payment verification (200)
10. `PATCH /api/students/:id/documents` document status toggling (200)
11. `PATCH /api/students/:id/scholarship` scholarship status transition (200)
12. `DELETE /api/students/:id` deletion (200)
13. `GET /api/stats` dashboard aggregation calculations (200)

---

## 📡 API Endpoints

### Student Record Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/students` | Get all students (supports `search`, `category`, `feeStatus`, `scholarshipStatus`, `sort`) |
| `GET` | `/api/students/:id` | Get specific student profile by ID |
| `POST` | `/api/students` | Create new student (auto-assigns category-specific documents) |
| `PUT` | `/api/students/:id` | Update student information |
| `DELETE` | `/api/students/:id` | Delete student record |
| `PATCH` | `/api/students/:id/documents` | Toggle/update document status (`Received` / `Pending`) |
| `PATCH` | `/api/students/:id/verify-payment` | Verify payment status (`paymentVerified: true`) |
| `PATCH` | `/api/students/:id/scholarship` | Update scholarship status |
| `GET` | `/api/stats` | Aggregated dashboard metrics & distribution figures |

### Monitoring & Operations Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Application status, uptime in seconds, timestamp, and environment |
| `GET` | `/metrics` | Prometheus metrics scrape target for Prometheus & Grafana |

---

## 📋 Sample Health Response (`/health`)
```json
{
  "status": "healthy",
  "application": "College Student Administration Portal v2.0",
  "uptimeSeconds": 145,
  "timestamp": "2026-10-08T07:45:00.000Z",
  "environment": "development"
}
```

---

## 📊 Sample Prometheus Metrics Response (`/metrics`)
```text
# HELP college_total_students Total registered students in the portal
# TYPE college_total_students gauge
college_total_students 18

# HELP college_pending_fees_count Count of students with pending or partial fees
# TYPE college_pending_fees_count gauge
college_pending_fees_count 9

# HELP college_missing_documents_count Count of students with missing or pending compliance documents
# TYPE college_missing_documents_count gauge
college_missing_documents_count 8

# HELP http_requests_total Total number of HTTP requests processed
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/students",status="200"} 4
```

---

## 🔒 Git Readiness

The `.gitignore` file is pre-configured to exclude `node_modules/`, logs, environment variables, and editor caches. You can initialize Git when ready:
```bash
git init
git add .
git commit -m "feat: College Student Administration Portal v2.0"
```
