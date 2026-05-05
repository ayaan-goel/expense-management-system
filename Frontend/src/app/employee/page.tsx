'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { 
  Plus, 
  Edit, 
  Send, 
  Upload,
  Calendar,
  DollarSign,
  Receipt,
  FileText
} from 'lucide-react'
import ProtectedLayout from '@/components/layout/ProtectedLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import api from '@/utils/api'
import { formatCurrency, formatDate, EXPENSE_CATEGORIES, CURRENCIES } from '@/utils/helpers'
import { Expense, CreateExpenseRequest, OCRResult } from '@/types'

export default function EmployeeDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<CreateExpenseRequest>({
    amount: 0,
    currency: 'USD',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    remarks: '',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateExpenseRequest, string>>>({})

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      const response = await api.get('/expenses/my')
      setExpenses(response.data.expenses || [])
    } catch (error: any) {
      toast.error('Failed to fetch expenses')
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateExpense = async (isDraft = true) => {
    if (!validateForm()) return

    try {
      const response = await api.post('/expenses', formData)
      const newExpense = response.data.expense

      setExpenses(prev => [newExpense, ...prev])
      setShowExpenseModal(false)
      resetForm()
      
      toast.success(`Expense ${isDraft ? 'saved as draft' : 'created'} successfully`)
      
      if (!isDraft) {
        // Submit the expense immediately
        await handleSubmitExpense(newExpense.id)
      }
    } catch (error: any) {
      toast.error('Failed to create expense')
      console.error('Error creating expense:', error)
    }
  }

  const handleUpdateExpense = async (expenseId: string) => {
    if (!validateForm()) return

    try {
      const response = await api.put(`/expenses/${expenseId}`, formData)
      const updatedExpense = response.data.expense

      setExpenses(prev => prev.map(exp => 
        exp._id === expenseId ? updatedExpense : exp
      ))
      
      setEditingExpense(null)
      setShowExpenseModal(false)
      resetForm()
      toast.success('Expense updated successfully')
    } catch (error: any) {
      toast.error('Failed to update expense')
      console.error('Error updating expense:', error)
    }
  }

  const handleSubmitExpense = async (expenseId: string) => {
    setSubmittingId(expenseId)
    try {
      await api.post(`/expenses/${expenseId}/submit`)
      
      setExpenses(prev => prev.map(exp => 
        exp._id === expenseId ? { ...exp, status: 'submitted' } : exp
      ))
      
      toast.success('Expense submitted for approval')
    } catch (error: any) {
      toast.error('Failed to submit expense')
      console.error('Error submitting expense:', error)
    } finally {
      setSubmittingId(null)
    }
  }

  const handleFileUpload = async (file: File) => {
    setOcrProcessing(true)
    try {
      const formData = new FormData()
      formData.append('receipt', file)
      
      const response = await api.post<OCRResult>('/ocr/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.parsed_fields) {
        const parsed = response.data.parsed_fields
        
        setFormData(prev => ({
          ...prev,
          amount: parsed.amount || prev.amount,
          currency: parsed.currency || prev.currency,
          category: parsed.category || prev.category,
          description: parsed.vendor ? `Expense at ${parsed.vendor}` : prev.description,
          date: parsed.date || prev.date,
        }))

        toast.success(`Receipt processed! Confidence: ${response.data.confidence_score?.toFixed(1)}%`)
        
        if (response.data.confidence_score < 70) {
          toast.error('Low confidence detected. Please verify the extracted information.')
        }
      }
    } catch (error: any) {
      toast.error('Failed to process receipt')
      console.error('Error processing OCR:', error)
    } finally {
      setOcrProcessing(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateExpenseRequest, string>> = {}

    if (!formData.amount || formData.amount <= 0) {
      errors.amount = 'Amount must be greater than 0'
    }

    if (!formData.category) {
      errors.category = 'Category is required'
    }

    if (!formData.description?.trim()) {
      errors.description = 'Description is required'
    }

    if (!formData.date) {
      errors.date = 'Date is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const resetForm = () => {
    setFormData({
      amount: 0,
      currency: 'USD',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      remarks: '',
    })
    setReceiptFile(null)
    setFormErrors({})
    setEditingExpense(null)
  }

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      amount: expense.amount,
      currency: 'USD', // Default currency as it's not in Expense type
      category: expense.category,
      description: expense.description,
      date: expense.date,
      remarks: '', // Default as it's not in Expense type
    })
    setShowExpenseModal(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'amount' ? parseFloat(value) || 0 : value 
    }))
    
    if (formErrors[name as keyof CreateExpenseRequest]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  if (loading) {
    return (
      <ProtectedLayout requiredRole="employee">
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout requiredRole="employee">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Expenses</h1>
            <p className="text-gray-600">Manage and track your expense reports</p>
          </div>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                <p className="text-lg font-semibold text-gray-900">{expenses.length}</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-lg font-semibold text-gray-900">
                  {expenses.filter(e => ['submitted', 'waiting_approval'].includes(e.status)).length}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Approved</p>
                <p className="text-lg font-semibold text-gray-900">
                  {expenses.filter(e => e.status === 'approved').length}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileText className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Draft</p>
                <p className="text-lg font-semibold text-gray-900">
                  {expenses.filter(e => e.status === 'draft').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="card">
          <div className="px-4 py-5 sm:p-6">
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">ID</th>
                    <th className="table-header-cell">Date</th>
                    <th className="table-header-cell">Category</th>
                    <th className="table-header-cell">Description</th>
                    <th className="table-header-cell">Amount</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No expenses found. Create your first expense!
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense._id}>
                        <td className="table-cell font-medium text-gray-900">
                          #{expense._id}
                        </td>
                        <td className="table-cell text-gray-900">
                          {formatDate(expense.date)}
                        </td>
                        <td className="table-cell text-gray-900">
                          {expense.category}
                        </td>
                        <td className="table-cell text-gray-900">
                          <div className="max-w-xs truncate" title={expense.description}>
                            {expense.description}
                          </div>
                        </td>
                        <td className="table-cell text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="table-cell">
                          <StatusBadge status={expense.status} />
                        </td>
                        <td className="table-cell">
                          <div className="flex space-x-2">
                            {expense.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => openEditModal(expense)}
                                  className="btn-outline btn-sm"
                                  title="Edit"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleSubmitExpense(expense._id)}
                                  disabled={submittingId === expense._id}
                                  className="btn-primary btn-sm"
                                  title="Submit"
                                >
                                  {submittingId === expense._id ? (
                                    <LoadingSpinner size="sm" color="white" />
                                  ) : (
                                    <Send className="h-3 w-3" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Expense Modal */}
        <Modal
          isOpen={showExpenseModal}
          onClose={() => {
            setShowExpenseModal(false)
            resetForm()
          }}
          title={editingExpense ? 'Edit Expense' : 'New Expense'}
        >
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0"
                  className={`input ${formErrors.amount ? 'input-error' : ''}`}
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
                {formErrors.amount && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.amount}</p>
                )}
              </div>

              <div>
                <label className="label">Currency</label>
                <select
                  name="currency"
                  className="input"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  {CURRENCIES.map(currency => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Category</label>
              <select
                name="category"
                className={`input ${formErrors.category ? 'input-error' : ''}`}
                value={formData.category}
                onChange={handleInputChange}
              >
                <option value="">Select category</option>
                {EXPENSE_CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {formErrors.category && (
                <p className="text-sm text-red-600 mt-1">{formErrors.category}</p>
              )}
            </div>

            <div>
              <label className="label">Date</label>
              <input
                type="date"
                name="date"
                className={`input ${formErrors.date ? 'input-error' : ''}`}
                value={formData.date}
                onChange={handleInputChange}
              />
              {formErrors.date && (
                <p className="text-sm text-red-600 mt-1">{formErrors.date}</p>
              )}
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                name="description"
                rows={2}
                className={`input ${formErrors.description ? 'input-error' : ''}`}
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter expense description"
              />
              {formErrors.description && (
                <p className="text-sm text-red-600 mt-1">{formErrors.description}</p>
              )}
            </div>

            <div>
              <label className="label">Remarks (Optional)</label>
              <textarea
                name="remarks"
                rows={2}
                className="input"
                value={formData.remarks}
                onChange={handleInputChange}
                placeholder="Additional notes"
              />
            </div>

            {/* Receipt Upload */}
            <div>
              <label className="label">Receipt (Optional)</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                      <span>Upload a receipt</span>
                      <input
                        type="file"
                        className="sr-only"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setReceiptFile(file)
                            handleFileUpload(file)
                          }
                        }}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, PDF up to 10MB
                  </p>
                  {ocrProcessing && (
                    <div className="flex items-center justify-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span className="text-sm text-primary-600">Processing receipt...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              {editingExpense ? (
                <button
                  type="button"
                  onClick={() => handleUpdateExpense(editingExpense._id)}
                  className="btn-primary flex-1"
                >
                  Update Expense
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleCreateExpense(true)}
                    className="btn-secondary flex-1"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateExpense(false)}
                    className="btn-primary flex-1"
                  >
                    Submit
                  </button>
                </>
              )}
            </div>
          </form>
        </Modal>
      </div>
    </ProtectedLayout>
  )
}
