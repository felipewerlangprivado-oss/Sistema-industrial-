
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2, X } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'fab';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', size = 'md', isLoading, className, ...props 
}) => {
  const baseStyles = "font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 relative overflow-hidden";
  
  const variants = {
    // Removed transparency modifiers (/80, /10, etc) and replaced with solid colors or explicit hover states
    primary: "bg-primary text-on-primary hover:brightness-110 shadow-md hover:shadow-lg rounded-full",
    secondary: "bg-secondary-container text-on-secondary-container hover:brightness-95 rounded-full",
    danger: "bg-error text-on-error hover:brightness-110 shadow-md hover:shadow-lg rounded-full",
    ghost: "bg-transparent text-on-surface hover:bg-surface-variant rounded-full",
    outline: "border border-outline text-primary hover:bg-primary-container hover:text-on-primary-container bg-transparent rounded-full",
    fab: "bg-primary-container text-on-primary-container shadow-lg hover:shadow-xl rounded-2xl border border-primary/10 hover:brightness-105"
  };

  const sizes = {
    sm: "h-8 px-4 text-sm",
    md: "h-10 px-6 text-sm",
    lg: "h-14 px-8 text-base", 
    xl: "h-16 px-8 text-lg font-bold",
  };

  return (
    <button className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
      {children}
    </button>
  );
};

// --- Card ---
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  // MD3 Elevated Card: Surface color + shadow, NO transparency
  return (
    <div className={cn("bg-surface text-on-surface rounded-2xl shadow-sm border border-outline-variant p-5", className)} {...props}>
      {children}
    </div>
  );
};

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  return (
    // Backdrop can be transparent (standard UX), but modal content must be solid
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200">
      <div className="bg-surface text-on-surface rounded-[28px] w-full max-w-sm md:max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border border-outline-variant">
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <h2 className="text-2xl font-normal text-on-surface">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh] text-on-surface-variant">
          {children}
        </div>
        {footer && (
          <div className="px-6 pb-6 pt-2 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode, color?: 'blue' | 'green' | 'yellow' | 'red' }> = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-primary-container text-on-primary-container',
    green: 'bg-success-container text-on-success-container',
    yellow: 'bg-secondary-container text-on-secondary-container',
    red: 'bg-error-container text-on-error-container',
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide", colors[color])}>
      {children}
    </span>
  );
};
