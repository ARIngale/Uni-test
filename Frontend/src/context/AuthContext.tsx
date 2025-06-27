"use client"

import { createContext, useState, useContext, useEffect, type ReactNode } from "react"
import React from 'react'

interface User {
  id: string
  email: string
  name: string
  isVerified: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isVerified: boolean
  isLoading: boolean
  login: (userData: User, token: string) => void
  logout: () => void
  setVerified: (status: boolean) => void
  clearAuthData: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Constants for session management
const UNVERIFIED_SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
const SESSION_TIMESTAMP_KEY = "session_timestamp"

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Function to clear all auth data
  const clearAuthData = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    localStorage.removeItem(SESSION_TIMESTAMP_KEY)
  }

  // Function to validate token (basic validation)
  const isTokenValid = (token: string): boolean => {
    try {
      // Basic JWT structure validation
      const parts = token.split(".")
      if (parts.length !== 3) return false

      // Decode payload to check expiration
      const payload = JSON.parse(atob(parts[1]))
      const currentTime = Math.floor(Date.now() / 1000)

      // Check if token is expired
      if (payload.exp && payload.exp < currentTime) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  // Function to check if unverified session has expired
  const isUnverifiedSessionExpired = (user: User): boolean => {
    if (user.isVerified) return false

    const sessionTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY)
    if (!sessionTimestamp) {
      // If no timestamp exists, create one
      localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString())
      return false
    }

    const sessionAge = Date.now() - Number.parseInt(sessionTimestamp)
    return sessionAge > UNVERIFIED_SESSION_TIMEOUT
  }

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedUser = localStorage.getItem("user")
        const savedToken = localStorage.getItem("token")

        if (savedUser && savedToken) {
          // Validate token before using it
          if (!isTokenValid(savedToken)) {
            console.log("Token is invalid or expired, clearing auth data")
            clearAuthData()
            setIsLoading(false)
            return
          }

          const parsedUser = JSON.parse(savedUser)

          // Validate user object structure
          if (parsedUser && parsedUser.id && parsedUser.email && parsedUser.name) {
            // Check if unverified session has expired
            if (isUnverifiedSessionExpired(parsedUser)) {
              console.log("Unverified session expired, clearing auth data")
              clearAuthData()
              setIsLoading(false)
              return
            }

            setUser(parsedUser)
            setToken(savedToken)

            // Set up auto-cleanup for unverified users
            if (!parsedUser.isVerified) {
              const sessionTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY)
              if (sessionTimestamp) {
                const remainingTime = UNVERIFIED_SESSION_TIMEOUT - (Date.now() - Number.parseInt(sessionTimestamp))
                if (remainingTime > 0) {
                  setTimeout(() => {
                    console.log("Auto-clearing unverified session")
                    clearAuthData()
                    window.location.reload()
                  }, remainingTime)
                }
              }
            }
          } else {
            console.log("Invalid user data structure, clearing auth data")
            clearAuthData()
          }
        }
      } catch (error) {
        console.error("Error loading auth state from localStorage:", error)
        // Clear corrupted data
        clearAuthData()
      } finally {
        setIsLoading(false)
      }
    }

    // Add a small delay to prevent flash of content
    const timer = setTimeout(initializeAuth, 100)
    return () => clearTimeout(timer)
  }, [])

  const login = (userData: User, userToken: string) => {
    setUser(userData)
    setToken(userToken)
    localStorage.setItem("user", JSON.stringify(userData))
    localStorage.setItem("token", userToken)

    // Set session timestamp for unverified users
    if (!userData.isVerified) {
      localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString())

      // Set up auto-cleanup timer
      setTimeout(() => {
        console.log("Auto-clearing unverified session")
        clearAuthData()
        window.location.reload()
      }, UNVERIFIED_SESSION_TIMEOUT)
    }
  }

  const logout = () => {
    clearAuthData()
  }

  const setVerified = (status: boolean) => {
    if (user) {
      const updatedUser = { ...user, isVerified: status }
      setUser(updatedUser)
      localStorage.setItem("user", JSON.stringify(updatedUser))

      // Clear session timestamp when user becomes verified
      if (status) {
        localStorage.removeItem(SESSION_TIMESTAMP_KEY)
      }
    }
  }

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isVerified: user?.isVerified || false,
    isLoading,
    login,
    logout,
    setVerified,
    clearAuthData,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
