import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  loading?: boolean
}

const variantStyles: Record<string, string> = {
  primary:
    'text-[var(--color-btn-primary-fg)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)] hover:from-[var(--color-primary-container)] hover:to-[var(--color-primary)] shadow-[var(--shadow-button-primary)]',
  secondary:
    'text-[var(--color-text-primary)] bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
}

const sizeStyles: Record<string, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-sm)]',
  md: 'h-10 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'h-12 px-6 text-base gap-2 rounded-[var(--radius-lg)]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
