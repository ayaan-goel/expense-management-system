'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Eye, EyeOff, Mail, Lock, User, Building, Globe, UserPlus } from 'lucide-react'
import api from '@/utils/api'
import { setAuthData, isAuthenticated, getRedirectPath } from '@/utils/auth'
import { isValidEmail } from '@/utils/helpers'
import { SignupRequest, AuthResponse, Country } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface SignupFormData extends SignupRequest {
  confirmPassword: string
  companyName: string
}

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    countryCode: '',
  })
  const [countries, setCountries] = useState<Country[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [errors, setErrors] = useState<Partial<SignupFormData>>({})

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated()) {
      const userRole = localStorage.getItem('user')
      if (userRole) {
        const user = JSON.parse(userRole)
        router.replace(getRedirectPath(user.role))
      }
    }

    // Fetch countries
    fetchCountries()
  }, [router])

  const fetchCountries = async () => {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flag')
      const data = await response.json()
      const sortedCountries = data
        .sort((a: Country, b: Country) => a.name.common.localeCompare(b.name.common))
      setCountries(sortedCountries)
    } catch (error) {
      toast.error('Failed to load countries')
      console.error('Error fetching countries:', error)
    } finally {
      setLoadingCountries(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<SignupFormData> = {}

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    }

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.companyName?.trim()) {
      newErrors.companyName = 'Company name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      // Prepare signup data
      const signupData: SignupRequest = {
        name: formData.name.trim(),
        email: formData.email,
        password: formData.password,
        countryCode: formData.countryCode || 'US',
      }

      const response = await api.post<AuthResponse>('/auth/signup', signupData)
      const { token, user } = response.data

      setAuthData(token, user)
      toast.success(`Welcome, ${user.name}! Your account has been created successfully.`)
      router.replace(getRedirectPath(user.role))
    } catch (error: any) {
      const message = error.response?.data?.error || 'Signup failed. Please try again.'
      toast.error(message)
      
      // Handle validation errors from backend
      if (error.response?.data?.errors) {
        const backendErrors: Partial<SignupFormData> = {}
        error.response.data.errors.forEach((err: any) => {
          backendErrors[err.field as keyof SignupFormData] = err.message
        })
        setErrors(backendErrors)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (errors[name as keyof SignupFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Create Account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Join us and start managing your expenses
          </p>
        </div>

        <div className="card p-8 space-y-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="label">
                  <User className="inline h-4 w-4 mr-1" />
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="email" className="label">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="companyName" className="label">
                  <Building className="inline h-4 w-4 mr-1" />
                  Company Name
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  className={`input ${errors.companyName ? 'input-error' : ''}`}
                  placeholder="Enter your company name"
                  value={formData.companyName}
                  onChange={handleInputChange}
                />
                {errors.companyName && (
                  <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="countryCode" className="label">
                  <Globe className="inline h-4 w-4 mr-1" />
                  Country
                </label>
                <select
                  id="countryCode"
                  name="countryCode"
                  className="input"
                  value={formData.countryCode}
                  onChange={handleInputChange}
                  disabled={loadingCountries}
                >
                  <option value="">
                    {loadingCountries ? 'Loading countries...' : 'Select your country'}
                  </option>
                  {countries.map((country) => (
                    <option key={country.cca2} value={country.cca2}>
                      {country.flag} {country.name.common}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="password" className="label">
                  <Lock className="inline h-4 w-4 mr-1" />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={`input ${errors.password ? 'input-error' : ''} pr-10`}
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">
                  <Lock className="inline h-4 w-4 mr-1" />
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={`input ${errors.confirmPassword ? 'input-error' : ''} pr-10`}
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || loadingCountries}
              className="btn-primary w-full flex justify-center py-3"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link 
                href="/login" 
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
