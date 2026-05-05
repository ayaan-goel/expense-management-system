'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/utils/api';
import { Expense, User, ExpenseStatus } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import ExpenseModal from '@/components/ExpenseModal';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface ExpenseStats {
  totalExpenses: number;
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  averageAmount: number;
  monthlyTotal: number;
}

interface DepartmentStat {
  department: string;
  totalAmount: number;
  count: number;
  averageAmount: number;
}

export default function AdminDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'users'>('overview');
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | 'all'>('all');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'expenses') {
      fetchExpenses();
    }
  }, [activeTab, filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Use the correct admin dashboard endpoint
      const statsResponse = await apiClient.get('/admin/dashboard');
      
      // Map backend response to frontend expected format
      const backendStats = statsResponse.data;
      const mappedStats = {
        totalExpenses: backendStats.expense_statistics?.total_expenses || 0,
        totalAmount: backendStats.expense_statistics?.total_approved_amount || 0,
        pendingCount: (backendStats.expense_statistics?.submitted || 0) + (backendStats.expense_statistics?.waiting_approval || 0),
        approvedCount: backendStats.expense_statistics?.approved || 0,
        rejectedCount: backendStats.expense_statistics?.rejected || 0,
        averageAmount: backendStats.expense_statistics?.avg_expense_amount || 0,
        monthlyTotal: backendStats.expense_statistics?.total_approved_amount || 0 // Using total for now
      };
      
      setStats(mappedStats);
      // Set users based on user statistics from backend
      const userStats = backendStats.user_statistics;
      const mockUsers = [];
      for (let i = 0; i < (userStats?.total_users || 0); i++) {
        mockUsers.push({
          _id: `user-${i}`,
          name: `User ${i + 1}`,
          email: `user${i + 1}@company.com`,
          role: (i === 0 ? 'admin' : i < (userStats?.managers || 0) + 1 ? 'manager' : 'employee') as 'admin' | 'manager' | 'employee',
          department: 'General',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setUsers(mockUsers);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await apiClient.get('/expenses', {
        params: filterStatus !== 'all' ? { status: filterStatus } : {}
      });
      
      // Map backend response to frontend expected format
      const backendExpenses = response.data.expenses || response.data.data || response.data;
      const mappedExpenses = backendExpenses.map((expense: any) => ({
        _id: expense.id.toString(),
        employeeId: expense.employee_id?.toString() || '',
        employeeName: expense.employee_name || '',
        employeeEmail: expense.employee_email || '',
        department: expense.department || 'N/A',
        description: expense.description || '',
        amount: expense.amount_in_company_currency || expense.amount || 0,
        category: expense.category || '',
        date: expense.expense_date || expense.created_at,
        receiptUrl: expense.receipt_path ? `/uploads/${expense.receipt_path}` : undefined,
        status: expense.status || 'draft',
        managerComment: expense.manager_comment || '',
        createdAt: expense.created_at || new Date().toISOString(),
        updatedAt: expense.updated_at || new Date().toISOString()
      }));
      
      setExpenses(mappedExpenses);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch expenses');
    }
  };

  const handleUserStatusToggle = async (userId: string, isActive: boolean) => {
    // User management not yet implemented in backend
    setError('User management functionality is not yet available');
    setTimeout(() => setError(''), 3000); // Clear error after 3 seconds
  };

  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Comprehensive system overview and management</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'expenses', 'users'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-8">
          {/* Main Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-800">Total Expenses</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalExpenses}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-800">Total Amount</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalAmount)}</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-yellow-800">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.pendingCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-purple-800">Avg. Amount</p>
                  <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats.averageAmount)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
                    <span className="text-gray-700">Pending</span>
                  </div>
                  <span className="font-medium">{stats.pendingCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                    <span className="text-gray-700">Approved</span>
                  </div>
                  <span className="font-medium">{stats.approvedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-400 rounded-full mr-3"></div>
                    <span className="text-gray-700">Rejected</span>
                  </div>
                  <span className="font-medium">{stats.rejectedCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month</h3>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-600">{formatCurrency(stats.monthlyTotal)}</p>
                <p className="text-gray-500 mt-2">Total expenses</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Users</h3>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-600">{users.filter(u => u.isActive).length}</p>
                <p className="text-gray-500 mt-2">of {users.length} total</p>
              </div>
            </div>
          </div>

          {/* Department Statistics */}
          {departmentStats.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Department</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Total Amount</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Count</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentStats.map((dept, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-4 px-4 font-medium">{dept.department}</td>
                          <td className="py-4 px-4">{formatCurrency(dept.totalAmount)}</td>
                          <td className="py-4 px-4">{dept.count}</td>
                          <td className="py-4 px-4">{formatCurrency(dept.averageAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center space-x-2">
                  <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
                    Filter by Status:
                  </label>
                  <select
                    id="status-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as ExpenseStatus | 'all')}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <button
                  onClick={fetchExpenses}
                  className="btn-secondary btn-sm"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                All Expenses {filterStatus !== 'all' && `(${filterStatus})`}
              </h2>
              
              {expenses.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">No expenses found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Employee</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Department</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Description</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((expense) => (
                        <tr key={expense._id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{expense.employeeName}</p>
                              <p className="text-sm text-gray-500">{expense.employeeEmail}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {expense.department}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-gray-900">{expense.description}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-medium text-gray-900">{formatCurrency(expense.amount)}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-gray-900">{formatDate(expense.date)}</p>
                          </td>
                          <td className="py-4 px-4">
                            <StatusBadge status={expense.status} />
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleViewExpense(expense)}
                              className="text-primary-600 hover:text-primary-800 font-medium text-sm"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
              <button
                onClick={fetchData}
                className="btn-secondary btn-sm"
              >
                Refresh
              </button>
            </div>
            
            {users.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <p className="text-gray-500">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Department</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Joined</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800'
                              : user.role === 'manager'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-gray-900">{user.department}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-gray-900">{formatDate(user.createdAt)}</p>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleUserStatusToggle(user._id, user.isActive)}
                            className={`text-sm font-medium ${
                              user.isActive
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showModal && selectedExpense && (
        <ExpenseModal
          expense={selectedExpense}
          onClose={() => {
            setShowModal(false);
            setSelectedExpense(null);
          }}
          isAdmin={true}
        />
      )}
    </div>
  );
}