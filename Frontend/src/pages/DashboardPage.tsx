"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { API_URL } from "../config"
import {
  ShoppingBag,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  User,
  LogOut,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Unlink,
} from "lucide-react"
import React from 'react'


interface AmazonAccount {
  connected: boolean
  orderCount?: number
  sellerId?: string
  connectedAt?: string
}

interface Order {
  orderId: string
  orderDate: string
  status: string
  amount: string | number
}


const DashboardPage = () => {
  const { user, token, logout } = useAuth()
  const [amazonAccount, setAmazonAccount] = useState<AmazonAccount>({ connected: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [ordersData, setOrdersData] = useState<Order[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>("")

  useEffect(() => {
    const checkAmazonConnection = async () => {
      try {
        const response = await fetch(`${API_URL}/api/amazon/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setAmazonAccount({
            connected: data.connected,
            orderCount: data.orderCount,
            sellerId: data.sellerId,
            connectedAt: data.connectedAt,
          })
        } else {
          console.error("Failed to check Amazon connection status")
        }
      } catch (err) {
        console.error("Error checking Amazon connection:", err)
      }
    }

    if (token) {
      checkAmazonConnection()
    }
  }, [token])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const connected = urlParams.get("connected")
    const errorParam = urlParams.get("error")

    if (connected === "true") {
      setError("")
      window.location.replace(window.location.pathname)
    } else if (errorParam) {
      switch (errorParam) {
        case "oauth_failed":
          setError("OAuth authorization failed. Please try again.")
          break
        case "connection_failed":
          setError("Failed to connect Amazon account. Please try again.")
          break
        default:
          setError("An error occurred during connection. Please try again.")
      }
    }
  }, [])

  const handleConnectAmazon = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_URL}/api/amazon/auth-url`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to get Amazon authorization URL")
      }

      const { authUrl } = await response.json()
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setLoading(false)
    }
  }

  const handleRefreshOrders = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_URL}/api/amazon/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to fetch orders")
      }

      const data = await response.json()
      setAmazonAccount((prev) => ({
        ...prev,
        connected: true,
        orderCount: data.orderCount,
      }))
      setOrdersData(data.orders || [])
      setLastUpdated(data.lastUpdated || new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectAmazon = async () => {
    if (!confirm("Are you sure you want to disconnect your Amazon account?")) {
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_URL}/api/amazon/disconnect`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to disconnect Amazon account")
      }

      setAmazonAccount({ connected: false })
      setOrdersData([])
      setLastUpdated("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white text-sm font-bold">U</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">UNIBAZAR</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, {user?.name?.split(" ")[0]}! 👋</h2>
            <p className="text-gray-600">Manage your Amazon seller account and track your business performance.</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Account Status */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {amazonAccount.connected ? (
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    ) : (
                      <AlertCircle className="h-8 w-8 text-yellow-500" />
                    )}
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Amazon Account</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {amazonAccount.connected ? "Connected" : "Not Connected"}
                      </dd>
                      {amazonAccount.sellerId && (
                        <dd className="text-xs text-gray-500">ID: {amazonAccount.sellerId}</dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Count */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ShoppingBag className="h-8 w-8 text-indigo-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Orders (30 days)</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {amazonAccount.connected ? (amazonAccount.orderCount ?? "—") : "—"}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Performance</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {amazonAccount.connected ? "Active" : "Inactive"}
                      </dd>
                      {amazonAccount.connectedAt && (
                        <dd className="text-xs text-gray-500">Connected: {formatDate(amazonAccount.connectedAt)}</dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Amazon Integration Card */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Amazon Seller Integration</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Connect your Amazon Seller account to view your order analytics and performance metrics.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              {amazonAccount.connected ? (
                <div className="space-y-6">
                  {/* Connected State */}
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      <div>
                        <h4 className="text-sm font-medium text-green-800">Amazon account successfully connected</h4>
                        <p className="text-sm text-green-600">Your account is synced and ready to use</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnectAmazon}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </button>
                  </div>

                  {/* Order Analytics */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">Order Analytics</h4>
                        <p className="text-sm text-gray-500">
                          Last 30 days performance
                          {lastUpdated && <span className="ml-2">• Updated: {formatDate(lastUpdated)}</span>}
                        </p>
                      </div>
                      <button
                        onClick={handleRefreshOrders}
                        disabled={loading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        {loading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    {/* Recent Orders Table */}
                    {ordersData.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3">Recent Orders</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                            <thead>
                              <tr className="bg-gray-100 text-sm text-gray-700">
                                <th className="py-3 px-4 text-left">Order ID</th>
                                <th className="py-3 px-4 text-left">Date</th>
                                <th className="py-3 px-4 text-left">Status</th>
                                <th className="py-3 px-4 text-left">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ordersData.slice(0, 10).map((order, idx) => (
                                <tr key={order.orderId} className="border-t text-sm text-gray-700">
                                  <td className="py-2 px-4 font-mono text-xs">{order.orderId}</td>
                                  <td className="py-2 px-4">{order.orderDate}</td>
                                  <td className="py-2 px-4">
                                    <span
                                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        order.status === "Shipped"
                                          ? "bg-green-100 text-green-800"
                                          : order.status === "Pending"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="py-2 px-4">{order.amount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {ordersData.length > 10 && (
                            <p className="text-sm text-gray-500 mt-2 text-center">
                              Showing 10 of {ordersData.length} orders
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {ordersData.length === 0 && !loading && (
                      <p className="text-sm text-gray-500 mt-4 text-center py-8">
                        No orders found in the last 30 days. Click "Refresh" to fetch your latest orders.
                      </p>
                    )}

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <ShoppingBag className="h-8 w-8 text-indigo-500 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-500">Total Orders</p>
                            <p className="text-2xl font-bold text-gray-900">{amazonAccount.orderCount || 0}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <TrendingUp className="h-8 w-8 text-green-500 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-500">Status</p>
                            <p className="text-2xl font-bold text-green-600">Active</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  {/* Not Connected State */}
                  <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBag className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Connect your Amazon Seller account</h3>
                  <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                    Link your Amazon Seller Central account to access your order data and analytics dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectAmazon}
                    disabled={loading}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="animate-spin -ml-1 mr-3 h-5 w-5" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="-ml-1 mr-3 h-5 w-5" />
                        Connect Amazon Account
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
