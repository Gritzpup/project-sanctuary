/**
 * @file ui.ts
 * @description UI component and state type definitions
 */

// ============================
// Component State Types
// ============================

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
  error?: string;
}

/**
 * Modal configuration
 */
export interface ModalConfig {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
}

/**
 * Notification message
 */
export interface NotificationMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number; // Auto-dismiss after milliseconds
  actions?: NotificationAction[];
}

/**
 * Notification action button
 */
export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Form field configuration
 */
export interface FormField {
  name: string;
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'date' | 'time';
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  validation?: ValidationRule[];
  options?: SelectOption[]; // For select, radio, checkbox
  min?: number; // For number, date
  max?: number; // For number, date
  step?: number; // For number
}

/**
 * Select option for dropdowns
 */
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

/**
 * Form validation rule
 */
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

/**
 * Form state management
 */
export interface FormState<T = any> {
  values: T;
  errors: { [key: string]: string };
  touched: { [key: string]: boolean };
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

// ============================
// Layout and Navigation Types
// ============================

/**
 * Navigation menu item
 */
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  onClick?: () => void;
  children?: MenuItem[];
  disabled?: boolean;
  badge?: string | number;
}

/**
 * Sidebar configuration
 */
export interface SidebarConfig {
  isCollapsed: boolean;
  width: number;
  collapsedWidth: number;
  position: 'left' | 'right';
  overlay?: boolean;
}

/**
 * Tab configuration
 */
export interface TabConfig {
  id: string;
  label: string;
  content: any;
  disabled?: boolean;
  closable?: boolean;
  icon?: string;
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

// ============================
// Data Display Types
// ============================

/**
 * Table column configuration
 */
export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => string | any;
  headerRender?: () => string | any;
}

/**
 * Table row action
 */
export interface TableAction<T = any> {
  label: string;
  icon?: string;
  action: (row: T) => void;
  disabled?: (row: T) => boolean;
  visible?: (row: T) => boolean;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Table configuration
 */
export interface TableConfig<T = any> {
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  selectable?: boolean;
  pagination?: boolean;
  sorting?: boolean;
  filtering?: boolean;
  striped?: boolean;
  hover?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Chart widget configuration
 */
export interface ChartWidget {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'candlestick' | 'area' | 'pie';
  data: any[];
  config?: any;
  height?: number;
  refreshInterval?: number;
}

/**
 * Dashboard layout
 */
export interface DashboardLayout {
  widgets: DashboardWidget[];
  columns: number;
  gap: number;
  responsive?: boolean;
}

/**
 * Dashboard widget
 */
export interface DashboardWidget {
  id: string;
  component: string;
  props?: any;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  resizable?: boolean;
  draggable?: boolean;
}

// ============================
// Theme and Styling Types
// ============================

/**
 * Application theme
 */
export interface AppTheme {
  name: string;
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  typography: {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: string;
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

/**
 * Responsive breakpoints
 */
export interface Breakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}