import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthCard } from './components/AuthCard'
import { Dashboard } from './components/Dashboard'
import {
  createExpense,
  editExpense,
  getExpenses,
  removeExpense,
  removeExpensesByRecurringId,
} from './services/expenses'
import {
  createRecurringExpense,
  getRecurringExpenses,
  removeRecurringExpense,
  updateRecurringExpense,
} from './services/recurringExpenses'
import { supabase } from './supabase'

const CATEGORIES = ['Food', 'Transport', 'Other']
const CURRENCIES = ['MKD', 'EUR', 'USD']
const FREQUENCIES = ['weekly', 'monthly', 'yearly']

const RATE_TO_USD = {
  MKD: 0.0176,
  EUR: 1.08,
  USD: 1,
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function normalizeCurrency(value) {
  return CURRENCIES.includes(value) ? value : 'MKD'
}

function normalizeFrequency(value) {
  return FREQUENCIES.includes(value) ? value : 'monthly'
}

function toYmd(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function addDays(yyyyMmDd, days) {
  const date = new Date(`${yyyyMmDd}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return toYmd(date)
}

function addOneMonth(yyyyMmDd) {
  const [yearRaw, monthRaw, dayRaw] = yyyyMmDd.split('-').map(Number)
  let year = yearRaw
  let month = monthRaw + 1

  if (month > 12) {
    month = 1
    year += 1
  }

  const monthMaxDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(dayRaw, monthMaxDay)

  return `${year}-${pad(month)}-${pad(day)}`
}

function addOneYear(yyyyMmDd) {
  const [yearRaw, monthRaw, dayRaw] = yyyyMmDd.split('-').map(Number)
  const year = yearRaw + 1
  const monthMaxDay = new Date(Date.UTC(year, monthRaw, 0)).getUTCDate()
  const day = Math.min(dayRaw, monthMaxDay)
  return `${year}-${pad(monthRaw)}-${pad(day)}`
}

function addRecurringInterval(yyyyMmDd, frequency) {
  if (frequency === 'weekly') return addDays(yyyyMmDd, 7)
  if (frequency === 'yearly') return addOneYear(yyyyMmDd)
  return addOneMonth(yyyyMmDd)
}

function getIsoWeekKey(yyyyMmDd) {
  const date = new Date(`${yyyyMmDd}T00:00:00Z`)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return `${year}-W${pad(week)}`
}

function getStatsKey(yyyyMmDd, granularity) {
  if (granularity === 'weekly') return getIsoWeekKey(yyyyMmDd)
  if (granularity === 'yearly') return yyyyMmDd.slice(0, 4)
  return yyyyMmDd.slice(0, 7)
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  const from = normalizeCurrency(fromCurrency)
  const to = normalizeCurrency(toCurrency)
  const fromRate = RATE_TO_USD[from]
  const toRate = RATE_TO_USD[to]

  if (!fromRate || !toRate) return amount
  if (from === to) return amount

  return (amount * fromRate) / toRate
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem('theme') || 'light'
  })

  const [baseCurrency, setBaseCurrency] = useState(() => {
    if (typeof window === 'undefined') return 'MKD'
    return normalizeCurrency(window.localStorage.getItem('baseCurrency') || 'MKD')
  })

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [expenses, setExpenses] = useState([])
  const [fetchingExpenses, setFetchingExpenses] = useState(false)

  const [recurringItems, setRecurringItems] = useState([])
  const [fetchingRecurring, setFetchingRecurring] = useState(false)

  const [expenseDate, setExpenseDate] = useState(todayDate())
  const [category, setCategory] = useState(CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [expenseCurrency, setExpenseCurrency] = useState(baseCurrency)

  const [recurringName, setRecurringName] = useState('')
  const [recurringCategory, setRecurringCategory] = useState(CATEGORIES[0])
  const [recurringAmount, setRecurringAmount] = useState('')
  const [recurringCurrency, setRecurringCurrency] = useState(baseCurrency)
  const [recurringFrequency, setRecurringFrequency] = useState('monthly')
  const [recurringNextDate, setRecurringNextDate] = useState(todayDate())

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [statsGranularity, setStatsGranularity] = useState('monthly')

  const fetchRecurring = useCallback(async () => {
    setFetchingRecurring(true)
    const { data, error } = await getRecurringExpenses()

    if (error) {
      setFetchingRecurring(false)
      return false
    }

    setRecurringItems(data || [])
    setFetchingRecurring(false)
    return true
  }, [])

  const fetchExpenses = useCallback(async () => {
    setFetchingExpenses(true)
    const { data, error } = await getExpenses()

    if (error) {
      setFetchingExpenses(false)
      return false
    }

    setExpenses(data || [])
    setFetchingExpenses(false)
    return true
  }, [])

  const applyDueRecurringExpenses = useCallback(async () => {
    const { data, error } = await getRecurringExpenses()

    if (error) {
      return false
    }

    const rules = data || []
    const today = todayDate()

    for (const rule of rules) {
      let nextDate = rule.next_due_date
      const recurringFrequencyValue = normalizeFrequency(rule.frequency)
      const recurringCurrencyValue = normalizeCurrency(rule.currency)

      while (nextDate <= today) {
        const payload = {
          expense_date: nextDate,
          category: rule.category,
          amount: Number(rule.amount),
          currency: recurringCurrencyValue,
          description: `Recurring: ${rule.name}`,
          recurring_expense_id: rule.id,
        }

        const { error: createError } = await createExpense(payload)
        if (createError && createError.code !== '23505') {
          return false
        }

        nextDate = addRecurringInterval(nextDate, recurringFrequencyValue)
      }

      if (nextDate !== rule.next_due_date) {
        const { error: updateError } = await updateRecurringExpense(rule.id, { next_due_date: nextDate })
        if (updateError) {
          return false
        }
      }
    }

    return true
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('baseCurrency', baseCurrency)
  }, [baseCurrency])

  useEffect(() => {
    let alive = true

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession()
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
  }, [])

  useEffect(() => {
    if (!session) {
      setExpenses([])
      setRecurringItems([])
      return
    }

    const syncData = async () => {
      await applyDueRecurringExpenses()
      await Promise.all([fetchExpenses(), fetchRecurring()])
    }

    syncData()
  }, [session, fetchExpenses, fetchRecurring, applyDueRecurringExpenses])

  const availableMonths = useMemo(() => {
    const months = new Set(expenses.map((item) => item.expense_date.slice(0, 7)))
    return Array.from(months).sort((a, b) => (a < b ? 1 : -1))
  }, [expenses])

  const filteredExpenses = useMemo(() => {
    const loweredQuery = searchQuery.trim().toLowerCase()
    return expenses.filter((item) => {
      const normalizedCurrency = normalizeCurrency(item.currency)
      const textBlock = `${item.category} ${item.description || ''} ${item.expense_date} ${normalizedCurrency}`.toLowerCase()

      if (selectedCategory && item.category !== selectedCategory) return false
      if (selectedMonth && !item.expense_date.startsWith(selectedMonth)) return false
      if (loweredQuery && !textBlock.includes(loweredQuery)) return false

      return true
    })
  }, [expenses, selectedCategory, selectedMonth, searchQuery])

  const visibleExpenses = useMemo(() => {
    return filteredExpenses.map((item) => {
      const currency = normalizeCurrency(item.currency)
      const originalAmount = Number(item.amount)
      const baseAmount = convertCurrency(originalAmount, currency, baseCurrency)

      return {
        ...item,
        currency,
        originalAmount,
        baseAmount,
      }
    })
  }, [filteredExpenses, baseCurrency])

  const summary = useMemo(() => {
    const total = visibleExpenses.reduce((acc, item) => acc + item.baseAmount, 0)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentMonthTotal = visibleExpenses
      .filter((item) => item.expense_date.startsWith(currentMonth))
      .reduce((acc, item) => acc + item.baseAmount, 0)

    return {
      total,
      currentMonthTotal,
      entries: visibleExpenses.length,
    }
  }, [visibleExpenses])

  const periodStats = useMemo(() => {
    const totals = new Map()
    const counts = new Map()

    visibleExpenses.forEach((item) => {
      const key = getStatsKey(item.expense_date, statsGranularity)
      totals.set(key, (totals.get(key) || 0) + item.baseAmount)
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
  }, [visibleExpenses, statsGranularity])

  const categoryChart = useMemo(() => {
    const totals = new Map()
    visibleExpenses.forEach((item) => {
      totals.set(item.category, (totals.get(item.category) || 0) + item.baseAmount)
    })

    return Array.from(totals.entries()).map(([name, total]) => ({ name, total }))
  }, [visibleExpenses])

  const dateChart = useMemo(() => {
    const totals = new Map()
    visibleExpenses.forEach((item) => {
      totals.set(item.expense_date, (totals.get(item.expense_date) || 0) + item.baseAmount)
    })

    return Array.from(totals.keys())
      .sort()
      .map((date) => ({ date, total: totals.get(date) || 0 }))
  }, [visibleExpenses])

  async function handleAuthSubmit(event) {
    event.preventDefault()

    if (!email || !password) {
      return
    }

    if (authMode === 'signup') {
      if (password !== confirmPassword) {
        return
      }

      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        return
      }

      setAuthMode('login')
      setPassword('')
      setConfirmPassword('')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return
    }

    setPassword('')
    setConfirmPassword('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function handleAddExpense(event) {
    event.preventDefault()

    const numericAmount = Number(amount)
    if (!expenseDate || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return
    }

    const payload = {
      expense_date: expenseDate,
      category,
      amount: numericAmount,
      currency: normalizeCurrency(expenseCurrency),
      description,
    }

    const { error } = await createExpense(payload)
    if (error) {
      return
    }

    setAmount('')
    setDescription('')
    await fetchExpenses()
  }

  async function handleAddRecurringExpense(event) {
    event.preventDefault()

    const numericAmount = Number(recurringAmount)
    if (!recurringName.trim() || !recurringNextDate || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return
    }

    const payload = {
      name: recurringName.trim(),
      category: recurringCategory,
      amount: numericAmount,
      currency: normalizeCurrency(recurringCurrency),
      frequency: normalizeFrequency(recurringFrequency),
      next_due_date: recurringNextDate,
    }

    const { error } = await createRecurringExpense(payload)
    if (error) {
      return
    }

    setRecurringName('')
    setRecurringAmount('')
    setRecurringCurrency(baseCurrency)
    setRecurringFrequency('monthly')
    setRecurringNextDate(todayDate())

    await applyDueRecurringExpenses()
    await Promise.all([fetchRecurring(), fetchExpenses()])
  }

  async function handleDeleteRecurringExpense(id) {
    const { error: expensesError } = await removeExpensesByRecurringId(id)
    if (expensesError) {
      return false
    }

    const { error } = await removeRecurringExpense(id)
    if (error) {
      return false
    }

    await Promise.all([fetchRecurring(), fetchExpenses()])
    return true
  }

  async function handleUpdateRecurringExpense(id, payload) {
    const numericAmount = Number(payload.amount)
    if (!payload.name?.trim() || !payload.next_due_date || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return false
    }

    const { error } = await updateRecurringExpense(id, {
      name: payload.name.trim(),
      category: payload.category,
      amount: numericAmount,
      currency: normalizeCurrency(payload.currency),
      frequency: normalizeFrequency(payload.frequency),
      next_due_date: payload.next_due_date,
    })
    if (error) {
      return false
    }

    await Promise.all([fetchRecurring(), fetchExpenses()])
    return true
  }

  async function handleUpdateExpense(id, payload) {
    const numericAmount = Number(payload.amount)
    if (!payload.expense_date || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return false
    }

    const { error } = await editExpense(id, {
      expense_date: payload.expense_date,
      category: payload.category,
      amount: numericAmount,
      currency: normalizeCurrency(payload.currency),
      description: payload.description,
    })
    if (error) {
      return false
    }

    await fetchExpenses()
    return true
  }

  async function handleDeleteExpense(id) {
    const { error } = await removeExpense(id)
    if (error) {
      return false
    }

    await fetchExpenses()
    return true
  }

  if (loading) {
    return <div className="center">Loading...</div>
  }

  if (!session) {
    return (
      <AuthCard
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
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      session={session}
      summary={summary}
      baseCurrency={baseCurrency}
      currencies={CURRENCIES}
      onBaseCurrencyChange={(event) => setBaseCurrency(normalizeCurrency(event.target.value))}
      expenseDate={expenseDate}
      category={category}
      amount={amount}
      description={description}
      expenseCurrency={expenseCurrency}
      categories={CATEGORIES}
      recurringItems={recurringItems.map((item) => ({
        ...item,
        currency: normalizeCurrency(item.currency),
        frequency: normalizeFrequency(item.frequency),
        baseAmount: convertCurrency(Number(item.amount), normalizeCurrency(item.currency), baseCurrency),
      }))}
      fetchingRecurring={fetchingRecurring}
      recurringName={recurringName}
      recurringCategory={recurringCategory}
      recurringAmount={recurringAmount}
      recurringCurrency={recurringCurrency}
      recurringFrequency={recurringFrequency}
      recurringNextDate={recurringNextDate}
      searchQuery={searchQuery}
      onExpenseDateChange={(event) => setExpenseDate(event.target.value)}
      onCategoryChange={(event) => setCategory(event.target.value)}
      onAmountChange={(event) => setAmount(event.target.value)}
      onDescriptionChange={(event) => setDescription(event.target.value)}
      onExpenseCurrencyChange={(event) => setExpenseCurrency(normalizeCurrency(event.target.value))}
      onAddExpense={handleAddExpense}
      onRecurringNameChange={(event) => setRecurringName(event.target.value)}
      onRecurringCategoryChange={(event) => setRecurringCategory(event.target.value)}
      onRecurringAmountChange={(event) => setRecurringAmount(event.target.value)}
      onRecurringCurrencyChange={(event) => setRecurringCurrency(normalizeCurrency(event.target.value))}
      onRecurringFrequencyChange={(event) => setRecurringFrequency(normalizeFrequency(event.target.value))}
      onRecurringNextDateChange={(event) => setRecurringNextDate(event.target.value)}
      onAddRecurringExpense={handleAddRecurringExpense}
      onDeleteRecurringExpense={handleDeleteRecurringExpense}
      onUpdateRecurringExpense={handleUpdateRecurringExpense}
      availableMonths={availableMonths}
      selectedCategory={selectedCategory}
      selectedMonth={selectedMonth}
      statsGranularity={statsGranularity}
      onCategoryFilterChange={(event) => setSelectedCategory(event.target.value)}
      onMonthFilterChange={(event) => setSelectedMonth(event.target.value)}
      onSearchQueryChange={(event) => setSearchQuery(event.target.value)}
      onStatsGranularityChange={(event) => setStatsGranularity(event.target.value)}
      onResetFilters={() => {
        setSelectedCategory('')
        setSelectedMonth('')
        setSearchQuery('')
      }}
      fetchingExpenses={fetchingExpenses}
      filteredExpenses={visibleExpenses}
      categoryChart={categoryChart}
      dateChart={dateChart}
      periodStats={periodStats}
      onLogout={handleLogout}
      onUpdateExpense={handleUpdateExpense}
      onDeleteExpense={handleDeleteExpense}
    />
  )
}
