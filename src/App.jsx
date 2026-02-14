import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthCard } from './components/AuthCard'
import { Dashboard } from './components/Dashboard'
import { createExpense, editExpense, getExpenses, removeExpense } from './services/expenses'
import { supabase } from './supabase'

const CATEGORIES = ['Food', 'Transport', 'Other']

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [expenses, setExpenses] = useState([])
  const [fetchingExpenses, setFetchingExpenses] = useState(false)

  const [expenseDate, setExpenseDate] = useState(todayDate())
  const [category, setCategory] = useState(CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  const [alert, setAlert] = useState(null)

  const setFlash = useCallback((type, message, durationMs = 2400) => {
    const id = Date.now()
    setAlert({ id, type, message })
    window.setTimeout(() => {
      setAlert((current) => (current && current.id === id ? null : current))
    }, durationMs)
  }, [])

  const fetchExpenses = useCallback(async () => {
    setFetchingExpenses(true)
    const { data, error } = await getExpenses()

    if (error) {
      setFlash('error', error.message, 2800)
      setFetchingExpenses(false)
      return false
    }

    setExpenses(data || [])
    setFetchingExpenses(false)
    return true
  }, [setFlash])

  useEffect(() => {
    let alive = true

    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        setFlash('error', error.message, 2600)
      }
      if (alive) {
        setSession(data?.session ?? null)
        setLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [setFlash])

  useEffect(() => {
    if (!session) {
      setExpenses([])
      return
    }

    fetchExpenses()
  }, [session, fetchExpenses])

  const availableMonths = useMemo(() => {
    const months = new Set(expenses.map((item) => item.expense_date.slice(0, 7)))
    return Array.from(months).sort((a, b) => (a < b ? 1 : -1))
  }, [expenses])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (selectedCategory && item.category !== selectedCategory) return false
      if (selectedMonth && !item.expense_date.startsWith(selectedMonth)) return false
      return true
    })
  }, [expenses, selectedCategory, selectedMonth])

  const summary = useMemo(() => {
    const total = filteredExpenses.reduce((acc, item) => acc + Number(item.amount), 0)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentMonthTotal = filteredExpenses
      .filter((item) => item.expense_date.startsWith(currentMonth))
      .reduce((acc, item) => acc + Number(item.amount), 0)

    return {
      total,
      currentMonthTotal,
      entries: filteredExpenses.length,
    }
  }, [filteredExpenses])

  const monthlyStats = useMemo(() => {
    const totals = new Map()
    const counts = new Map()

    filteredExpenses.forEach((item) => {
      const key = item.expense_date.slice(0, 7)
      totals.set(key, (totals.get(key) || 0) + Number(item.amount))
      counts.set(key, (counts.get(key) || 0) + 1)
    })

    const rows = Array.from(totals.keys())
      .sort((a, b) => (a < b ? 1 : -1))
      .map((month) => ({
        month,
        total: totals.get(month) || 0,
        entries: counts.get(month) || 0,
      }))

    const best = rows.length
      ? rows.reduce((prev, current) => (current.total > prev.total ? current : prev), rows[0])
      : null

    const average = rows.length ? rows.reduce((acc, row) => acc + row.total, 0) / rows.length : 0

    return { rows, best, average }
  }, [filteredExpenses])

  const categoryChart = useMemo(() => {
    const totals = new Map()
    filteredExpenses.forEach((item) => {
      totals.set(item.category, (totals.get(item.category) || 0) + Number(item.amount))
    })

    return Array.from(totals.entries()).map(([name, total]) => ({ name, total }))
  }, [filteredExpenses])

  const dateChart = useMemo(() => {
    const totals = new Map()
    filteredExpenses.forEach((item) => {
      totals.set(item.expense_date, (totals.get(item.expense_date) || 0) + Number(item.amount))
    })

    return Array.from(totals.keys())
      .sort()
      .map((date) => ({ date, total: totals.get(date) || 0 }))
  }, [filteredExpenses])

  async function handleAuthSubmit(event) {
    event.preventDefault()

    if (!email || !password) {
      setFlash('error', 'Email and password are required.')
      return
    }

    if (authMode === 'signup') {
      if (password !== confirmPassword) {
        setFlash('error', 'Passwords do not match.')
        return
      }

      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setFlash('error', error.message, 3200)
        return
      }

      setFlash('success', 'Account created. Verify your email to continue.', 2600)
      setPassword('')
      setConfirmPassword('')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setFlash('error', error.message, 3200)
      return
    }

    setFlash('success', 'Logged in.', 1300)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setFlash('error', error.message, 2800)
      return
    }

    setFlash('info', 'Logged out.', 1600)
  }

  async function handleAddExpense(event) {
    event.preventDefault()

    const numericAmount = Number(amount)
    if (!expenseDate || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setFlash('error', 'Enter a valid date and amount.')
      return
    }

    const payload = {
      expense_date: expenseDate,
      category,
      amount: numericAmount,
      description,
    }

    const { error } = await createExpense(payload)
    if (error) {
      setFlash('error', error.message, 2800)
      return
    }

    setAmount('')
    setDescription('')
    await fetchExpenses()
    setFlash('success', 'Expense added.', 1200)
  }

  async function handleUpdateExpense(id, payload) {
    const { error } = await editExpense(id, payload)
    if (error) {
      setFlash('error', error.message, 2800)
      return false
    }

    await fetchExpenses()
    setFlash('success', 'Expense updated.', 1200)
    return true
  }

  async function handleDeleteExpense(id) {
    const { error } = await removeExpense(id)
    if (error) {
      setFlash('error', error.message, 2800)
      return false
    }

    await fetchExpenses()
    setFlash('success', 'Expense deleted.', 1200)
    return true
  }

  if (loading) {
    return <div className="center">Loading...</div>
  }

  if (!session) {
    return (
      <AuthCard
        alert={alert}
        authMode={authMode}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        onEmailChange={(event) => setEmail(event.target.value)}
        onPasswordChange={(event) => setPassword(event.target.value)}
        onConfirmPasswordChange={(event) => setConfirmPassword(event.target.value)}
        onSubmit={handleAuthSubmit}
        onModeToggle={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
      />
    )
  }

  return (
    <Dashboard
      alert={alert}
      session={session}
      summary={summary}
      expenseDate={expenseDate}
      category={category}
      amount={amount}
      description={description}
      categories={CATEGORIES}
      onExpenseDateChange={(event) => setExpenseDate(event.target.value)}
      onCategoryChange={(event) => setCategory(event.target.value)}
      onAmountChange={(event) => setAmount(event.target.value)}
      onDescriptionChange={(event) => setDescription(event.target.value)}
      onAddExpense={handleAddExpense}
      availableMonths={availableMonths}
      selectedCategory={selectedCategory}
      selectedMonth={selectedMonth}
      onCategoryFilterChange={(event) => setSelectedCategory(event.target.value)}
      onMonthFilterChange={(event) => setSelectedMonth(event.target.value)}
      onResetFilters={() => {
        setSelectedCategory('')
        setSelectedMonth('')
      }}
      fetchingExpenses={fetchingExpenses}
      filteredExpenses={filteredExpenses}
      categoryChart={categoryChart}
      dateChart={dateChart}
      monthlyStats={monthlyStats}
      onLogout={handleLogout}
      onUpdateExpense={handleUpdateExpense}
      onDeleteExpense={handleDeleteExpense}
    />
  )
}
