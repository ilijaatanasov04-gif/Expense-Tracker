import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from './supabase'

const CATEGORIES = ['Food', 'Transport', 'Other']

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function showDate(yyyyMmDd) {
  return yyyyMmDd
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
  }, [])

  useEffect(() => {
    if (!session) {
      setExpenses([])
      return
    }
    fetchExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

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

    const average = rows.length
      ? rows.reduce((acc, row) => acc + row.total, 0) / rows.length
      : 0

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

  function setFlash(type, message, durationMs = 2400) {
    const id = Date.now()
    setAlert({ id, type, message })
    window.setTimeout(() => {
      setAlert((current) => (current && current.id === id ? null : current))
    }, durationMs)
  }

  async function fetchExpenses() {
    setFetchingExpenses(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('id, expense_date, category, amount, description, created_at')
      .order('expense_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setFlash('error', error.message, 2800)
      setFetchingExpenses(false)
      return
    }

    setExpenses(data || [])
    setFetchingExpenses(false)
  }

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

      setFlash('success', 'Account created.', 1300)
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

    const { error } = await supabase.from('expenses').insert(payload)
    if (error) {
      setFlash('error', error.message, 2800)
      return
    }

    setAmount('')
    setDescription('')
    await fetchExpenses()
    setFlash('success', 'Expense added.', 1200)
  }

  if (loading) {
    return <div className="center">Loading...</div>
  }

  if (!session) {
    return (
      <main className="app-shell">
        {alert ? <AlertBox alert={alert} /> : null}
        <section className="auth-card">
          <h1>{authMode === 'login' ? 'Expense Tracker' : 'Create Account'}</h1>
          <p>
            {authMode === 'login'
              ? 'Sign in to manage your expenses.'
              : 'Create account and keep your expenses private.'}
          </p>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />

            {authMode === 'signup' ? (
              <>
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </>
            ) : null}

            <button type="submit">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
          </form>

          <p className="auth-switch">
            {authMode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="text-link"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            >
              {authMode === 'login' ? 'Create one' : 'Login'}
            </button>
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      {alert ? <AlertBox alert={alert} /> : null}

      <header className="topbar">
        <div>
          <h1>Expense Tracker Dashboard</h1>
          <p>{session.user.email}</p>
        </div>
        <button className="ghost-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="summary-grid">
        <SummaryCard title="Total Spent" value={`${summary.total.toFixed(2)} MKD`} />
        <SummaryCard title="This Month" value={`${summary.currentMonthTotal.toFixed(2)} MKD`} />
        <SummaryCard title="Entries" value={String(summary.entries)} />
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>Add New Expense</h2>
          <form className="expense-form" onSubmit={handleAddExpense}>
            <label>Date</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
              required
            />

            <label>Category</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label>Amount</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />

            <label>Description (optional)</label>
            <input
              type="text"
              maxLength={200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <button type="submit">Save Expense</button>
          </form>
        </article>

        <article className="panel">
          <h2>All Expenses</h2>

          <div className="filter-form">
            <div>
              <label>Category</label>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="">All</option>
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Month</label>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                <option value="">All</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-actions">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('')
                  setSelectedMonth('')
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {fetchingExpenses ? <p className="empty">Loading...</p> : null}

          {filteredExpenses.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredExpenses].reverse().map((item) => (
                    <tr key={item.id}>
                      <td>{showDate(item.expense_date)}</td>
                      <td>{item.category}</td>
                      <td>{Number(item.amount).toFixed(2)} MKD</td>
                      <td>{item.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No expenses yet.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Spending Graphs</h2>
        {filteredExpenses.length ? (
          <div className="charts-grid">
            <figure>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </figure>
            <figure>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </figure>
          </div>
        ) : (
          <p className="empty">Add some expenses to see charts.</p>
        )}
      </section>

      <section className="panel">
        <h2>Monthly Statistics</h2>
        {monthlyStats.rows.length ? (
          <>
            <div className="monthly-top">
              <p>
                Average per month: <strong>{monthlyStats.average.toFixed(2)} MKD</strong>
              </p>
              {monthlyStats.best ? (
                <p>
                  Highest month: <strong>{monthlyStats.best.month}</strong> (
                  {monthlyStats.best.total.toFixed(2)} MKD)
                </p>
              ) : null}
            </div>

            <div className="table-wrap monthly-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total</th>
                    <th>Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.rows.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{row.total.toFixed(2)} MKD</td>
                      <td>{row.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="empty">No monthly stats yet.</p>
        )}
      </section>
    </main>
  )
}

function SummaryCard({ title, value }) {
  return (
    <article className="summary-card">
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  )
}

function AlertBox({ alert }) {
  return <section className={`flash flash-${alert.type}`}>{alert.message}</section>
}
