# MediStock – Enterprise Pharmacy ERP & POS Management System

MediStock is a centralized, production-grade Pharmacy Enterprise Resource Planning (ERP) and Point of Sale (POS) system built with **Node.js**, **Express.js**, **React 18**, **Vite**, and **MySQL 8.0**.

It delivers strict role-based separation across three dedicated portals communicating with a unified, high-integrity relational database:
1. 🏛️ **Executive Admin Portal** (`/`)
2. 💊 **Clinical Pharmacist Workspace** (`/pharmacist`)
3. 🛍️ **Customer Pharmacy Portal** (`/customer`)
Overview
MediStock is a full-stack Pharmacy Enterprise Resource Planning (ERP) and Point of Sale (POS) application built to bring essential pharmacy operations into one centralized system.

It provides three role-based portals backed by a shared MySQL database:
1. Administrator Portal – manages pharmacy operations, users, inventory, suppliers, purchases, finances, and reports.
2. Pharmacist Workspace – supports prescription review, medicine dispensing, expiry monitoring, returns, and POS billing.
3. Customer Portal – allows customers to browse medicines, upload prescriptions, place orders, and view order information.
The project is deployed online, with the frontend hosted on Vercel and the backend and MySQL database hosted on Railway.
Live Demo
Resource	Link
MediStock website	https://medi-stock-five.vercel.app/
Login page	https://medi-stock-five.vercel.app/login
Backend health endpoint	https://medistock-production-cb9c7137.up.railway.app/api/v1/health
GitHub repository	https://github.com/Raushansinghania/Medi_Stock


Demo access: The login page provides demo login options for the available roles. Use those options to explore the application. Do not publish production passwords, database credentials, API secrets, or private customer information in this repository.

Technology Stack
Layer	Technologies
Frontend	React 18, Vite, JavaScript, HTML, CSS
Backend	Node.js, Express.js
Database	MySQL 8.0, InnoDB
API	REST APIs
Authentication	JWT, bcryptjs
Validation and security	Zod, Helmet, Express Rate Limit, parameterized SQL queries
Testing	Jest, Supertest
Frontend deployment	Vercel
Backend and database hosting	Railway


Key Features
- Three role-based portals for administrators, pharmacists, and customers.
- Role-based access control (RBAC) for protected application areas and API routes.
- Medicine catalogue and category management.
- Batch-level inventory tracking and expiry monitoring.
- FEFO (First Expiry, First Out) stock allocation.
- Supplier and purchase order management.
- POS billing, sales records, payment handling, and printable invoices.
- Digital prescription upload, review, approval, rejection, and dispensing workflow.
- Customer registration, medicine browsing, cart, checkout, and order tracking.
- Returns and refund inspection workflow.
- Financial summaries, reports, notifications, and audit logs.
---

## 🌟 Key Architecture & Highlights

- **Three Dedicated Panels & Strict RBAC:** Role isolation enforced at both the UI router level and backend API middleware level. Pharmacists and Customers cannot access administrative endpoints, and vice versa.
- **ACID Transactional FEFO Engine:** First Expiry, First Out (FEFO) automated allocation engine at the batch level (`medicine_batches`) preventing dispensing of expired or quarantined medications.
- **Clinical Prescription Verification Pipeline:** End-to-end digital lifecycle (`pending` ➔ `under_review` ➔ `approved` / `rejected` ➔ `dispensed`) with image/PDF preview, verification checklists, and audit logging.
- **Return Quarantine Workflow:** Returned medications enter a quarantined inspection state (`pending_inspection`) before pharmacist approval restocks or marks them as damaged/discarded.
- **High-Velocity POS Billing:** Multi-payment support (Cash, Card, UPI with dynamic QR code generation), automated tax & discount computations, and instant thermal/A4 printable receipts.
- **Live MySQL Analytics:** Real-time financial calculations (Gross Revenue, COGS, Net Profit, Inventory Valuation, and Supplier Payables) derived directly from relational tables.

---

## 👥 Three Role-Based Panels

### 1. 🏛️ Administrator Portal (`/`)
*For Pharmacy Owners, Operations Directors & Lead Administrators*
- **Central Command Center (`/`):** Real-time MySQL-calculated business metrics (Sales Revenue, Total Purchases, Gross Profit, Operating Expenses, Net Profit, Profit Margin %), inventory status (Total SKUs, Available Stock, Out-of-Stock, Low Stock Alerts, Expired Batches, Near Expiry), and operational queues. Dynamic date filtering (`Today`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Last Month`, `Custom Date Range`) and interactive charts (daily sales trends, monthly sales vs purchases vs expenses, category sales breakdown, top-selling medicines).
- **Medicine Master Management (`/medicines`):** Global drug registry with formulations, dosage strengths, categories, reorder levels, MRP, selling price, and prescription-requirement flags with complete CRUD capabilities.
- **Inventory & Batch Control (`/inventory`):** Batch-level tracking (`batch_number`, `expiry_date`, `cost_price`, `selling_price`), FEFO status, atomic stock adjustments with mandatory reason logging, and comprehensive stock movement history.
- **Supplier Directory (`/suppliers`):** Vendor profiles with GSTIN, payment terms (`Net 15`, `Net 30`, `Net 60`), active/inactive status, total order counts, purchase spend, and outstanding payables.
- **Purchase Order Workflow (`/purchases`):** Structured procurement workflow with PO lifecycle statuses (`draft`, `ordered`, `received`, `cancelled`). Includes a "Receive Goods" modal that records batch numbers and expiry dates, transactionally updating stock and logging stock movements upon receipt.
- **Sales & Invoices Management (`/sales`):** Transaction records with customer names, payment methods, line items with batch numbers, printable receipts, and a controlled cancellation workflow that restores inventory and logs reason-coded audit trails.
- **Prescription Clinical Oversight (`/prescriptions`):** Complete clinical queue oversight with status counters (`pending`, `under_review`, `approved`, `rejected`, `dispensed`), document viewer modal (Image/PDF), and verification remarks inspection, maintaining clinical exclusivity for licensed pharmacists.
- **Financial Management & Ledger (`/finance`):** Real-time Profit & Loss statement derived from MySQL (Sales Revenue, COGS, Gross Profit, Operating Expenses, Net Profit, Profit Margin %), payment inflow breakdown (Cash, Card, UPI), balance sheet liabilities (accounts payable to suppliers), inventory valuation at cost vs retail, and CSV export.
- **Operating Expenses Ledger (`/expenses`):** Categorized operational overhead tracking (Rent, Electricity, Salaries, Maintenance, Delivery, Software) directly factored into Net Profit calculations.
- **Returns & Refunds (`/returns`):** Quarantine inspection decision center (`pending_inspection` ➔ `approved_restock` vs `damaged_discarded`), managing credit and batch restoration.
- **Reports & Analytics (`/reports`):** 12 distinct relational reports with date filters and 1-click CSV export:
  1. Sales Summary & Daily Breakdown
  2. Inventory Valuation (Cost vs Retail)
  3. Expiry Report (Expired & Near-Expiry)
  4. Low Stock & Reorder Report
  5. Profit & Loss Statement
  6. Fast & Slow-Moving Medicines
  7. Supplier Purchase & Payables Summary
  8. Prescription Verification Statistics
  9. Customer Purchase History
  10. Tax & GST Collection Report
  11. Operating Expenses Breakdown
  12. Sales Returns & Wastage Audit
- **Audit Logs (`/audit-logs`):** Immutable chronological record of system events, user actions, inventory adjustments, and status changes.
- **Operational Notifications (`/notifications`):** Categorized alert center for inventory warnings, near-expiry batches, pending prescriptions, and system notices.
- **Employee Management (`/employees`):** Staff roster across Admin, Pharmacist, and Cashier roles, account provisioning, profile editing, and secure administrator password resets.
- **User Governance (`/users`):** Centralized directory of all registered accounts across all roles (Admin, Pharmacist, Cashier, Customer), status toggling (`active` / `inactive`), and self-deactivation protection.
- **System Settings (`/settings`):** Pharmacy configuration stored in `system_settings` table: Trading Profile (store name, license, GSTIN, contact), Billing & Tax (GST %, currency symbol, invoice prefix), and Inventory Rules (low stock threshold, critical expiry days).
- **Admin Profile (`/profile`):** Practitioner profile management and secure credential updates.

---

### 2. 💊 Pharmacist Operations Workspace (`/pharmacist`)
*For Licensed Pharmacists & Dispensary Staff*
- **Clinical Operations Dashboard:** Live counts of today's sales, completed bills, pending prescription reviews, near-expiry alerts, and dispensing velocity.
- **Prescription Verification Queue:**
  - View patient information, prescribing doctor, and uploaded prescription documents (JPG/PNG/PDF).
  - Built-in clinical verification checklist (Legibility, Dosage, Drug Interactions, Expiry).
  - Decision controls: *Approve*, *Move to Under Review*, *Dispense*, or *Reject with mandatory clinical reason*.
- **High-Speed POS Billing:**
  - Instant barcode scan simulation and drug name search.
  - Multi-batch FEFO preview showing exact batches deducted.
  - Walk-in customer quick registration modal.
  - Dynamic UPI QR Code generator for cashless payments.
  - Instant printable tax invoice.
- **Interactive FEFO Simulator:** Visual sandbox demonstrating multi-batch allocation logic (e.g. splitting 70 units across Batches A and B based on expiry date).
- **Tiered Expiry Monitoring:** Tabbed monitoring interface classifying batches into:
  - 🚨 Expired (automatic blocking)
  - ⚠️ Critical (≤ 30 Days)
  - ⏳ Moderate (≤ 60 Days)
  - 📅 Approaching (≤ 90 Days)
  - Manual Quarantine (`Block Batch` / `Unblock Batch`) controls.
- **Returns & Quarantine Inspection:**
  - Search original invoice items.
  - Two-stage clinical inspection: `pending_inspection` ➔ Pharmacist determines `approved_restock` (restores batch units and logs stock movement) or `damaged_discarded`.
- **Customer Directory:** Patient contact list with direct 1-click POS billing launch.
- **Dispensing Audit Trail:** Chronological log of all dispensed medicines with batch numbers and pharmacist timestamps.

---

### 3. 🛍️ Customer Pharmacy Portal (`/customer`)
*For Registered Patients & Retail Consumers*
- **E-Commerce Patient Dashboard:** Active orders summary, prescription verification statuses, and recently ordered medications.
- **Live MySQL Medicine Catalogue:**
  - Debounced real-time search across brand name, generic name, category, and strength.
  - Category filters (Antibiotics, Analgesics, Chronic Care, Vitamins).
  - Stock availability badges and Prescription-Required indicators.
- **Prescription Digital Upload:**
  - Drag-and-drop file upload supporting images and PDF files up to 5MB.
  - Notes field for dosage instructions or doctor details.
- **Prescription Tracker:** Live timeline indicating review status (`Pending Review`, `Under Review`, `Approved`, `Rejected`), with pharmacist remarks prominently displayed.
- **Cart & Checkout:**
  - Preserves items across sessions.
  - Automatically flags Rx-required medicines with linked prescription verification checks.
  - Delivery address selection and payment method selector.
- **Order Tracking & Invoices:** Real-time fulfillment progress and downloadable printable PDF tax invoices.

---

## 🗄️ Relational Database Architecture (MySQL 8.0)

MediStock runs on 16 relational InnoDB tables with foreign key constraints and transactional integrity:

```
+--------------------+       +----------------------+       +----------------------+
|       users        | <---< |    prescriptions     |       |      suppliers       |
+--------------------+       +----------------------+       +----------------------+
          |                                                            |
          v                                                            v
+--------------------+       +----------------------+       +----------------------+
|     customers      |       |      medicines       | <---< |      purchases       |
+--------------------+       +----------------------+       +----------------------+
          |                             |                              |
          v                             v                              v
+--------------------+       +----------------------+       +----------------------+
|       sales        |       |   medicine_batches   |       |   purchase_items     |
+--------------------+       +----------------------+       +----------------------+
    |          |                        |
    v          v                        v
+---------+  +------------+  +----------------------+
| payments|  | sale_items |  |   stock_movements    |
+---------+  +------------+  +----------------------+
    |              |                    |
    v              v                    v
+---------+  +------------+  +----------------------+
| returns |  | categories |  |      audit_logs      |
+---------+  +------------+  +----------------------+
```

### Key Schema Enhancements:
- **`system_settings`**: Relational key-value store with categories (`general`, `billing`, `inventory`, `notifications`) powering dynamic pharmacy configuration.
- **`medicine_batches`**: Multi-batch inventory tracking (`batch_number`, `expiry_date`, `quantity`, `cost_price`, `selling_price`, `is_blocked`).
- **`purchases` & `purchase_items`**: Procurement status tracking (`draft`, `ordered`, `received`, `cancelled`) with batch numbers, expiry dates, and tax allocations.
- **`prescriptions`**: Review status enum (`pending`, `under_review`, `approved`, `rejected`, `dispensed`), verification remarks, and pharmacist reviewer foreign key (`verified_by`, `dispensed_by`).
- **`sales` & `sale_items`**: Traceability linking sold units to batches (`batch_id`, `batch_number`), cancellation workflow fields (`status`, `cancellation_reason`, `cancelled_by`, `cancelled_at`).
- **`suppliers`**: GSTIN, commercial payment terms (`Net 15`, `Net 30`, `Net 60`), and vendor status flags.
- **`users`**: Extended roles (`admin`, `pharmacist`, `cashier`, `customer`), employee identifiers, contact phone, physical address, and status toggles.
- **`returns`**: Two-stage clinical inspection (`pending_inspection`, `approved_restock`, `damaged_discarded`), inspector reference, and clinical disposition notes.

---

## 🔑 Demo Access Credentials

| Role | Email | Password | Landing Route |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@medistock.com` | `Admin@123` | `/` |
| **Pharmacist** | `pharmacist@medistock.com` | `Pharmacist@123` | `/pharmacist` |
| **Customer** | `customer@medistock.com` | `Customer@123` | `/customer` |

*Single-click demo login buttons are provided on the login page for rapid evaluation.*

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x
- **MySQL Server 8.0** active on `127.0.0.1:3306`

### 2. Configure Environment
In `server/.env`:
```env
PORT=5000
NODE_ENV=development

# MySQL Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=medistock_app
DB_PASSWORD=your_mysql_password
DB_NAME=medistock

# Connection Pooling
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0

# Security & JWT
JWT_SECRET=medistock_jwt_super_secret_dev_key_change_in_production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### 3. Install Dependencies
```bash
npm run install:all
```

### 4. Database Setup & Seed Data
Run database migrations and seed baseline records:
```bash
# Seed initial demo users, medicines, batches, and suppliers
npm run seed

# Run the Pharmacist Panel multi-batch & FEFO migration
node server/src/config/migrate_pharmacist_panel.js

# Run the Enterprise Admin Panel schema migration (settings, users, PO receive, audit fields)
node server/src/config/migrate_admin_panel.js
```

### 5. Start Application
Launch both backend API and Vite client concurrently:
```bash
npm run dev
```

- **Frontend Client:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **API Health Telemetry:** [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

---

## 🧪 Comprehensive Automated Test Suites

The project features a rigorous Jest & Supertest automated test suite covering all RBAC boundaries, FEFO transactions, procurement workflows, prescription verification, and executive telemetry:

```bash
# Run all backend tests
npm test
```

### Test Suite Summary:
- **`tests/admin_panel.test.js`**: 15 comprehensive end-to-end integration tests verifying:
  - Admin authentication, role validation, and strict RBAC isolation (blocking unauthorized roles).
  - Central Command Center real-time telemetry, date-range filtering, and relational financial KPIs.
  - Staff employee lifecycle (provisioning, role enforcement, profile updates, secure password reset).
  - Centralized user governance and self-deactivation protection.
  - Multi-status purchase order workflow (`draft` ➔ `ordered` ➔ `received`) and atomic Goods Receipt with batch allocation.
  - Controlled sales cancellation workflow with atomic inventory restoration and audit logging.
  - Clinical prescription oversight without bypassing licensed pharmacist verification boundaries.
  - System settings key-value retrieval and updates.
  - 12 relational business reports verification.
  - Full financial ledger P&L aggregation.
  - Preservation of Pharmacist (`/pharmacist`) and Customer (`/customer`) portals.
- **`tests/pharmacist_panel.test.js`**: 13 comprehensive end-to-end integration tests verifying:
  - Pharmacist authentication and RBAC boundary isolation.
  - Live KPI metrics calculation from MySQL.
  - Real-time FEFO allocation calculation across multiple batches.
  - Multi-batch deduction during checkout transactions.
  - Blocking and rejection of expired batch dispensing.
  - Tiered expiry monitoring classification.
  - Batch quarantine (`block` / `unblock`).
  - Prescription verification lifecycle (`under_review`, `approved`, `rejected` with mandatory reason validation).
  - Two-stage returns quarantine inspection (`restock` vs `discard`).
  - Prescription document secure retrieval.
  - Dispensing audit trail generation.
- **`tests/api.test.js`**: Core REST API endpoint tests.
- **`tests/auth.test.js`**: JWT authentication, bcrypt hash validation, and role middleware tests.
- **`tests/db.test.js`**: MySQL connection pool and ACID transaction rollback verification.
- **`tests/health.test.js`**: System uptime, memory metrics, and database connectivity.

**Test Results: 6/6 test suites passing (77/77 tests passing cleanly).**

---

## 📦 Production Build

To verify production bundling:
```bash
npm run build:client
```
The React frontend compiles via Vite into optimized static assets with zero TypeScript or Rollup errors.

---

## 🛡️ Security Best Practices
- **Password Security:** BCrypt hashing with salt rounds = 10.
- **Token Security:** HTTP-only cookies and Bearer token JWT verification.
- **Injection Prevention:** Parameterized SQL queries using `mysql2/promise` prepared statements across all database interactions.
- **API Hardening:** Express Rate Limiting, Helmet HTTP headers, CORS origin whitelisting, and Zod input schema validation.
