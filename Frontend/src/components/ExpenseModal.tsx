'use client';

import { useState } from 'react';
import { Expense } from '@/types';
import StatusBadge from './ui/StatusBadge';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface ExpenseModalProps {
  expense: Expense;
  onClose: () => void;
  onApprove?: (status: 'approved' | 'rejected', comment?: string) => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expenseId: string) => void;
  isManager?: boolean;
  isAdmin?: boolean;
  isEmployee?: boolean;
}

export default function ExpenseModal({
  expense,
  onClose,
  onApprove,
  onEdit,
  onDelete,
  isManager = false,
  isAdmin = false,
  isEmployee = false
}: ExpenseModalProps) {
  const [comment, setComment] = useState('');
  const [showCommentField, setShowCommentField] = useState(false);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleApprovalAction = (status: 'approved' | 'rejected') => {
    setActionType(status);
    setShowCommentField(true);
  };

  const handleSubmitApproval = () => {
    if (actionType && onApprove) {
      onApprove(actionType, comment.trim() || undefined);
      setComment('');
      setShowCommentField(false);
      setActionType(null);
    }
  };

  const handleCancelApproval = () => {
    setComment('');
    setShowCommentField(false);
    setActionType(null);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(expense._id);
      onClose();
    }
  };

  const canApprove = isManager && expense.status === 'pending';
  const canEdit = isEmployee && (expense.status === 'draft' || expense.status === 'pending');
  const canDelete = isEmployee && expense.status === 'draft';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Expense Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Employee Info */}
          {(isManager || isAdmin) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Employee Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{expense.employeeName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{expense.employeeEmail}</p>
                </div>
                {expense.department && (
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="font-medium text-gray-900">{expense.department}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expense Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="font-medium text-gray-900">{expense.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(expense.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Category</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {expense.category}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Date</p>
              <p className="font-medium text-gray-900">{formatDate(expense.date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <StatusBadge status={expense.status} />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Submitted</p>
              <p className="font-medium text-gray-900">{formatDate(expense.createdAt)}</p>
            </div>
          </div>

          {/* Receipt */}
          {expense.receiptUrl && (
            <div>
              <p className="text-sm text-gray-500 mb-2">Receipt</p>
              <div className="border border-gray-200 rounded-lg p-4">
                <img
                  src={expense.receiptUrl}
                  alt="Receipt"
                  className="max-w-full h-auto rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Manager Comments */}
          {expense.managerComment && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Manager Comments</h3>
              <p className="text-blue-900">{expense.managerComment}</p>
            </div>
          )}

          {/* Approval Actions for Managers */}
          {canApprove && !showCommentField && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-3">Manager Actions</h3>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleApprovalAction('approved')}
                  className="btn-primary"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
                <button
                  onClick={() => handleApprovalAction('rejected')}
                  className="btn-danger"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Comment Field for Approval */}
          {showCommentField && actionType && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {actionType === 'approved' ? 'Approval' : 'Rejection'} Comment
              </h3>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`Add a comment for ${actionType === 'approved' ? 'approval' : 'rejection'} (optional)`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={handleCancelApproval}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitApproval}
                  className={actionType === 'approved' ? 'btn-primary' : 'btn-danger'}
                >
                  Confirm {actionType === 'approved' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </div>
          )}

          {/* Employee Actions */}
          {isEmployee && (canEdit || canDelete) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-3">Actions</h3>
              <div className="flex space-x-3">
                {canEdit && onEdit && (
                  <button
                    onClick={() => onEdit(expense)}
                    className="btn-secondary"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                )}
                {canDelete && onDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800 mb-2">Confirm Deletion</h3>
              <p className="text-red-700 text-sm mb-4">
                Are you sure you want to delete this expense? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}