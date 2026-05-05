'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, hasRole, hasAnyRole } from '@/utils/auth'
import { RouteGuardProps } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function RouteGuard({ 
  children, 
  requiredRole, 
  fallback 
}: RouteGuardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        router.replace('/login')
        return
      }

      // Check role-based access if required
      if (requiredRole) {
        let hasAccess = false

        if (typeof requiredRole === 'string') {
          hasAccess = hasRole(requiredRole)
        } else if (Array.isArray(requiredRole)) {
          hasAccess = hasAnyRole(requiredRole)
        }

        if (!hasAccess) {
          router.replace('/login')
          return
        }
      }

      setIsAuthorized(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [router, requiredRole])

  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}