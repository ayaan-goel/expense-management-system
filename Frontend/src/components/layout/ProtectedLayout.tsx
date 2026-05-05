'use client'

import { useState } from 'react'
import RouteGuard from './RouteGuard'
import Navbar from './Navbar'

interface ProtectedLayoutProps {
  children: React.ReactNode
  requiredRole?: string | string[]
}

export default function ProtectedLayout({ children, requiredRole }: ProtectedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <RouteGuard requiredRole={requiredRole}>
      <div className="min-h-screen bg-gray-50">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </RouteGuard>
  )
}