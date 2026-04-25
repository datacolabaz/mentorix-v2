const variants = {
  primary:
    [
      'bg-primary text-[#041018]',
      'shadow-[0_18px_40px_rgba(34,224,136,0.18)]',
      'hover:shadow-[0_22px_56px_rgba(34,224,136,0.24)]',
      'hover:brightness-[1.02] hover:scale-[1.02] active:scale-[0.99]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    ].join(' '),
  secondary:
    [
      'bg-transparent text-white',
      'border border-white/15',
      'hover:bg-white/[0.06] hover:border-white/25',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    ].join(' '),
  danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30',
  ghost:
    [
      'bg-transparent',
      'text-gray-300/80 hover:text-white',
      'hover:bg-white/[0.06]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    ].join(' '),
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  loading, className = '', ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center gap-2 rounded-xl font-semibold
        transition-[transform,box-shadow,background-color,border-color,color,filter] duration-200 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
