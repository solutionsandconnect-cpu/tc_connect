const variants = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-orange-100 text-orange-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
}

interface BadgeProps {
  label: string
  variant?: keyof typeof variants
}

export default function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${variants[variant]}`}>
      {label}
    </span>
  )
}