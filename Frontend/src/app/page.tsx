'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, getUserRole, getRedirectPath } from '@/utils/auth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      const userRole = getUserRole()
      if (userRole) {
        router.replace(getRedirectPath(userRole))
      }
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}