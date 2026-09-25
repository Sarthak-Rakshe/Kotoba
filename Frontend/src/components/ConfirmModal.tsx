import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, HelpCircle, X, Loader2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  icon,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const defaultIcon =
    variant === 'danger' ? (
      <Trash2 className="w-5 h-5" />
    ) : variant === 'warning' ? (
      <AlertTriangle className="w-5 h-5" />
    ) : (
      <HelpCircle className="w-5 h-5" />
    );

  const iconBadgeStyles = {
    danger: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    primary: 'bg-[var(--color-sage-light)] border-[var(--color-sage)]/30 text-[var(--color-sage)]',
  }[variant];

  const confirmBtnStyles = {
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus:ring-rose-500/40',
    warning:
      'bg-amber-600 hover:bg-amber-700 text-white shadow-sm focus:ring-amber-500/40',
    primary:
      'btn-primary shadow-sm',
  }[variant];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="glass-panel max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon and Title */}
        <div className="flex items-start gap-3.5 pr-6">
          <div
            className={`p-2.5 rounded-2xl border ${iconBadgeStyles} shrink-0`}
          >
            {icon || defaultIcon}
          </div>
          <div>
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-[var(--text-primary)] leading-tight"
            >
              {title}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {variant === 'danger'
                ? 'Irreversible administrative action'
                : 'Confirmation required'}
            </p>
          </div>
        </div>

        {/* Message body */}
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed pt-1">
          {message}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary text-xs py-2 px-3.5 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 ${confirmBtnStyles}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
