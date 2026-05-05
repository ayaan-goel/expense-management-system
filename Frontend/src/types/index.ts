// User types
export interface User {
  _id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  department: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  countryCode?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

// Expense types
export type ExpenseStatus = 'draft' | 'pending' | 'submitted' | 'approved' | 'rejected';

export interface Expense {
  _id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department?: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  managerComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  amount: number;
  currency?: string;
  category: string;
  description: string;
  date: string;
  remarks?: string;
}

// Approval types
export interface ApprovalRequest {
  id: number;
  expense_id: number;
  approval_rule_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  current_step: number;
  total_steps: number;
  created_at: string;
  updated_at: string;
  expense?: Expense;
}

export interface ApprovalAction {
  action: 'approve' | 'reject' | 'escalate';
  comments?: string;
}

// Approval Rule types
export interface ApprovalRule {
  id: number;
  company_id: number;
  name: string;
  description?: string;
  rule_type: 'percentage' | 'specific_approver' | 'hybrid';
  percentage_threshold?: number;
  specific_approver_id?: number;
  is_manager_approver: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateApprovalRuleRequest {
  name: string;
  description?: string;
  rule_type: 'percentage' | 'specific_approver' | 'hybrid';
  percentage_threshold?: number;
  specific_approver_id?: number;
  is_manager_approver: boolean;
}

// OCR types
export interface OCRResult {
  id: number;
  expense_id?: number;
  file_path: string;
  parsed_fields: {
    vendor?: string;
    amount?: number;
    currency?: string;
    date?: string;
    category?: string;
    lineItems?: Array<{
      description: string;
      amount: number;
    }>;
    confidence_details?: {
      vendor?: number;
      amount?: number;
      date?: number;
      category?: number;
    };
  };
  confidence_score: number;
  processing_status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

// Country type for signup
export interface Country {
  name: {
    common: string;
    official: string;
  };
  cca2: string;
  cca3: string;
  flag: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'date' | 'textarea' | 'file';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// Modal types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Table types
export interface TableColumn<T = any> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// Route guard types
export interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  fallback?: React.ReactNode;
}