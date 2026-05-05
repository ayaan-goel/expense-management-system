// Currency formatting utility
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Date formatting utility
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Date formatting for form inputs
export const formatDateForInput = (dateString?: string): string => {
  if (!dateString) return new Date().toISOString().split('T')[0];
  return new Date(dateString).toISOString().split('T')[0];
};

// Status badge colors
export const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'submitted':
    case 'waiting_approval':
      return 'bg-warning-100 text-warning-800';
    case 'approved':
      return 'bg-success-100 text-success-800';
    case 'rejected':
      return 'bg-danger-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Expense categories
export const EXPENSE_CATEGORIES = [
  'Travel',
  'Meals',
  'Office Supplies',
  'Equipment',
  'Software',
  'Training',
  'Marketing',
  'Utilities',
  'Entertainment',
  'Other'
];

// Currency list
export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'INR',
  'AUD',
  'JPY',
  'CNY'
];

// File size formatter
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Validation helpers
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Generate unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};
