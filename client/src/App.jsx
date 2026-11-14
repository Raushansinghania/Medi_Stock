import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

// Layouts for the 3 distinct role-based panels
import AppLayout from '@/components/layout/AppLayout';
import PharmacistLayout from '@/components/layout/PharmacistLayout';
import CustomerLayout from '@/components/layout/CustomerLayout';

// Auth
import LoginPage from '@/features/auth/LoginPage';

// Admin Panel Features
import DashboardPage from '@/features/dashboard/DashboardPage';
import MedicinesPage from '@/features/medicines/MedicinesPage';
import OrdersManagementPage from '@/features/orders/OrdersManagementPage';
import POSBillingPage from '@/features/pos/POSBillingPage';
import SalesPage from '@/features/sales/SalesPage';
import SuppliersPage from '@/features/suppliers/SuppliersPage';
import CustomersPage from '@/features/customers/CustomersPage';
import PurchasesPage from '@/features/purchases/PurchasesPage';
import InventoryPage from '@/features/inventory/InventoryPage';
import EmployeesPage from '@/features/employees/EmployeesPage';
import UserManagementPage from '@/features/users/UserManagementPage';
import PrescriptionOversightPage from '@/features/prescriptions/PrescriptionOversightPage';
import FinancialManagementPage from '@/features/finance/FinancialManagementPage';
import ExpensesPage from '@/features/expenses/ExpensesPage';
import ReturnsPage from '@/features/returns/ReturnsPage';
import ReportsPage from '@/features/reports/ReportsPage';
import AuditLogsPage from '@/features/audit/AuditLogsPage';
import NotificationsPage from '@/features/notifications/NotificationsPage';
import SettingsPage from '@/features/settings/SettingsPage';
import AdminProfilePage from '@/features/profile/AdminProfilePage';

// Pharmacist Panel Features (12 Clinical & Dispensing Modules)
import PharmacistDashboardPage from '@/features/pharmacist/PharmacistDashboardPage';
import PharmacistPrescriptionVerificationPage from '@/features/pharmacist/PharmacistPrescriptionVerificationPage';
import PharmacistPOSPage from '@/features/pharmacist/PharmacistPOSPage';
import PharmacistCataloguePage from '@/features/pharmacist/PharmacistCataloguePage';
import PharmacistInventoryPage from '@/features/pharmacist/PharmacistInventoryPage';
import PharmacistFEFOPage from '@/features/pharmacist/PharmacistFEFOPage';
import PharmacistExpiryMonitoringPage from '@/features/pharmacist/PharmacistExpiryMonitoringPage';
import PharmacistCustomersPage from '@/features/pharmacist/PharmacistCustomersPage';
import PharmacistSalesPage from '@/features/pharmacist/PharmacistSalesPage';
import PharmacistReturnsPage from '@/features/pharmacist/PharmacistReturnsPage';
import PharmacistNotificationsPage from '@/features/pharmacist/PharmacistNotificationsPage';
import PharmacistProfilePage from '@/features/pharmacist/PharmacistProfilePage';

// Customer Portal Features
import CustomerDashboardPage from '@/features/customer/CustomerDashboardPage';
import CustomerBrowseMedicinesPage from '@/features/customer/CustomerBrowseMedicinesPage';
import CustomerSearchMedicinesPage from '@/features/customer/CustomerSearchMedicinesPage';
import CustomerCartPage from '@/features/customer/CustomerCartPage';
import CustomerCheckoutPage from '@/features/customer/CustomerCheckoutPage';
import CustomerOrdersPage from '@/features/customer/CustomerOrdersPage';
import CustomerOrderTrackingPage from '@/features/customer/CustomerOrderTrackingPage';
import CustomerInvoicesPage from '@/features/customer/CustomerInvoicesPage';
import CustomerPaymentsPage from '@/features/customer/CustomerPaymentsPage';
import CustomerUploadPrescriptionPage from '@/features/customer/CustomerUploadPrescriptionPage';
import CustomerPrescriptionsPage from '@/features/customer/CustomerPrescriptionsPage';
import CustomerProfilePage from '@/features/customer/CustomerProfilePage';
import CustomerNotificationsPage from '@/features/customer/CustomerNotificationsPage';

// Role Guard for Admin Panel: strictly prevents Pharmacist and Customer from seeing Admin dashboard
function AdminRoute({ children }) {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'customer') {
    return <Navigate to="/customer" replace />;
  }
  if (user?.role === 'pharmacist') {
    return <Navigate to="/pharmacist" replace />;
  }
  return children;
}

// Role Guard for Pharmacist Panel: accessible by Pharmacist
function PharmacistRoute({ children }) {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'customer') {
    return <Navigate to="/customer" replace />;
  }
  return children;
}

// Role Guard for Customer Portal
function CustomerRoute({ children }) {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'pharmacist') {
    return <Navigate to="/pharmacist" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* 1. ADMIN PANEL: Full Business Administration */}
      <Route
        path="/"
        element={
          <AdminRoute>
            <AppLayout />
          </AdminRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="medicines" element={<MedicinesPage />} />
        <Route path="orders" element={<OrdersManagementPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="prescriptions" element={<PrescriptionOversightPage />} />
        <Route path="pos" element={<POSBillingPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="finance" element={<FinancialManagementPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<AdminProfilePage />} />
      </Route>

      {/* 2. PHARMACIST PANEL: Clinical Operations, FEFO Dispensing & Rx Verification */}
      <Route
        path="/pharmacist"
        element={
          <PharmacistRoute>
            <PharmacistLayout />
          </PharmacistRoute>
        }
      >
        <Route index element={<PharmacistDashboardPage />} />
        <Route path="prescriptions" element={<PharmacistPrescriptionVerificationPage />} />
        <Route path="orders" element={<OrdersManagementPage />} />
        <Route path="pos" element={<PharmacistPOSPage />} />
        <Route path="medicines" element={<PharmacistCataloguePage />} />
        <Route path="inventory" element={<PharmacistInventoryPage />} />
        <Route path="fefo" element={<PharmacistFEFOPage />} />
        <Route path="expiry" element={<PharmacistExpiryMonitoringPage />} />
        <Route path="customers" element={<PharmacistCustomersPage />} />
        <Route path="sales" element={<PharmacistSalesPage />} />
        <Route path="returns" element={<PharmacistReturnsPage />} />
        <Route path="notifications" element={<PharmacistNotificationsPage />} />
        <Route path="profile" element={<PharmacistProfilePage />} />
      </Route>

      {/* 3. CUSTOMER PORTAL: Patient Pharmacy, Prescriptions & Orders */}
      <Route
        path="/customer"
        element={
          <CustomerRoute>
            <CustomerLayout />
          </CustomerRoute>
        }
      >
        <Route index element={<CustomerDashboardPage />} />
        <Route path="medicines" element={<CustomerBrowseMedicinesPage />} />
        <Route path="search" element={<CustomerSearchMedicinesPage />} />
        <Route path="cart" element={<CustomerCartPage />} />
        <Route path="checkout" element={<CustomerCheckoutPage />} />
        <Route path="orders" element={<CustomerOrdersPage />} />
        <Route path="orders/tracking" element={<CustomerOrderTrackingPage />} />
        <Route path="invoices" element={<CustomerInvoicesPage />} />
        <Route path="payments" element={<CustomerPaymentsPage />} />
        <Route path="prescriptions/upload" element={<CustomerUploadPrescriptionPage />} />
        <Route path="prescriptions" element={<CustomerPrescriptionsPage />} />
        <Route path="profile" element={<CustomerProfilePage />} />
        <Route path="notifications" element={<CustomerNotificationsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
