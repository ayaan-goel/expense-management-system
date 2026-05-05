'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Receipt, 
  CheckSquare, 
  Settings, 
  Users, 
  ChevronDown,
  DollarSign
} from 'lucide-react'
import { getAuthData, clearAuthData, getUserRole } from '@/utils/auth'

interface NavbarProps {
  onToggleSidebar?: () => void
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const router = useRouter()
  const { user } = getAuthData()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = () => {
    clearAuthData()
    toast.success('Logged out successfully')
    router.push('/login')
  }

  const getNavLinks = () => {
    const role = getUserRole()
    
    switch (role) {
      case 'employee':
        return [
          { href: '/employee', label: 'My Expenses', icon: Receipt }
        ]
      case 'manager':
        return [
          { href: '/dashboard/manager', label: 'Approvals', icon: CheckSquare }
        ]
      case 'admin':
        return [
          { href: '/dashboard/admin', label: 'Dashboard', icon: Users }
        ]
      default:
        return []
    }
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left section */}
          <div className="flex items-center">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            <Link href="/" className="flex items-center ml-2 md:ml-0">
              <div className="flex-shrink-0 flex items-center">
                <DollarSign className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">ExpenseTracker</span>
              </div>
            </Link>

            {/* Navigation Links - Desktop */}
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              {getNavLinks().map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors duration-150"
                >
                  <link.icon className="h-4 w-4 mr-1" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center">
            {/* User menu */}
            <div className="ml-3 relative">
              <div>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center max-w-xs bg-white rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="ml-2 hidden md:flex md:flex-col md:items-start">
                      <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
                    </div>
                    <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
                  </div>
                </button>
              </div>

              {/* User dropdown menu */}
              {showUserMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div className="font-medium">{user?.name}</div>
                      <div className="text-gray-500">{user?.email}</div>
                    </div>
                    
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {getNavLinks().map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center pl-3 pr-4 py-2 text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            >
              <link.icon className="h-5 w-5 mr-2" />
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}