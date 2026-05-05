import { getStatusColor } from '@/utils/helpers'

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colorClass = getStatusColor(status)
  
  return (
    <span className={`badge ${colorClass} ${className}`}>
      {status.replace('_', ' ')}
    </span>
  )
}