import { Suspense, lazy, useMemo, useState } from 'react'

const SpendingCharts = lazy(() => import('./SpendingCharts'))

function showDate(yyyyMmDd) {
  return yyyyMmDd
}

function showPeriodLabel(granularity) {
  if (granularity === 'weekly') return 'Week'
  if (granularity === 'yearly') return 'Year'
  return 'Month'
}

function SummaryCard({ title, value }) {
  return (
    <article className="summary-card">
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  )
}

function ConfirmDialog({ open, title, message, confirmLabel, onCancel, onConfirm }) {
  if (!open) return null

  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <section
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function ExpensesPanel({
  categories,
  currencies,
  baseCurrency,
  availableMonths,
  selectedCategory,
  selectedMonth,
  searchQuery,
  onCategoryFilterChange,
  onMonthFilterChange,
  onSearchQueryChange,
  onResetFilters,
  fetchingExpenses,
  filteredExpenses,
  onUpdateExpense,
  onDeleteExpense,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editCategory, setEditCategory] = useState(categories[0])
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState(currencies[0])
  const [editDescription, setEditDescription] = useState('')
  const [rowBusyId, setRowBusyId] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  const editingItem = useMemo(
    () => filteredExpenses.find((item) => item.id === editingId) || null,
    [filteredExpenses, editingId]
  )

  function startEdit(item) {
    setEditingId(item.id)
    setEditDate(item.expense_date)
    setEditCategory(item.category)
    setEditAmount(String(Number(item.originalAmount)))
    setEditCurrency(item.currency)
    setEditDescription(item.description || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDate('')
    setEditCategory(categories[0])
    setEditAmount('')
    setEditCurrency(currencies[0])
    setEditDescription('')
  }

  async function saveEdit() {
    if (!editingItem) return

    const numericAmount = Number(editAmount)
    if (!editDate || Number.isNaN(numericAmount) || numericAmount <= 0) return

    setRowBusyId(editingItem.id)
    const ok = await onUpdateExpense(editingItem.id, {
      expense_date: editDate,
      category: editCategory,
      amount: numericAmount,
      currency: editCurrency,
      description: editDescription,
    })
    setRowBusyId(null)

    if (ok) {
      cancelEdit()
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return

    setRowBusyId(pendingDeleteId)
    await onDeleteExpense(pendingDeleteId)
    setRowBusyId(null)
    setPendingDeleteId(null)

    if (editingId === pendingDeleteId) {
      cancelEdit()
    }
  }

  return (
    <article className="panel">
      <h2>All Expenses</h2>

      <div className="filter-form">
        <div>
          <label>Search</label>
          <input type="text" placeholder="Search description/category/date" value={searchQuery} onChange={onSearchQueryChange} />
        </div>

        <div>
          <label>Category</label>
          <select value={selectedCategory} onChange={onCategoryFilterChange}>
            <option value="">All</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Month</label>
          <select value={selectedMonth} onChange={onMonthFilterChange}>
            <option value="">All</option>
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-actions">
          <button type="button" onClick={onResetFilters}>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredExpenses].reverse().map((item) => {
                const isEditing = item.id === editingId
                const isBusy = item.id === rowBusyId

                return (
                  <tr key={item.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          type="date"
                          value={editDate}
                          onChange={(event) => setEditDate(event.target.value)}
                        />
                      ) : (
                        showDate(item.expense_date)
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="table-input"
                          value={editCategory}
                          onChange={(event) => setEditCategory(event.target.value)}
                        >
                          {categories.map((categoryOption) => (
                            <option key={categoryOption} value={categoryOption}>
                              {categoryOption}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.category
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="split-field">
                          <input
                            className="table-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editAmount}
                            onChange={(event) => setEditAmount(event.target.value)}
                          />
                          <select className="table-input" value={editCurrency} onChange={(event) => setEditCurrency(event.target.value)}>
                            {currencies.map((currencyOption) => (
                              <option key={currencyOption} value={currencyOption}>
                                {currencyOption}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div>{item.originalAmount.toFixed(2)} {item.currency}</div>
                          {item.currency !== baseCurrency ? (
                            <div className="sub-amount">~ {item.baseAmount.toFixed(2)} {baseCurrency}</div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          type="text"
                          maxLength={200}
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                        />
                      ) : (
                        item.description || '-'
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <button type="button" disabled={isBusy} onClick={saveEdit}>
                              Save
                            </button>
                            <button type="button" className="ghost-btn" disabled={isBusy} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" disabled={isBusy || Boolean(editingId)} onClick={() => startEdit(item)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-btn"
                              disabled={isBusy || Boolean(editingId)}
                              onClick={() => setPendingDeleteId(item.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No expenses yet.</p>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete Expense?"
        message="This action will permanently remove the expense."
        confirmLabel="Delete Expense"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </article>
  )
}

function RecurringExpensesPanel({
  categories,
  currencies,
  baseCurrency,
  recurringItems,
  fetchingRecurring,
  onDeleteRecurringExpense,
  onUpdateRecurringExpense,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState(categories[0])
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState(currencies[0])
  const [editNextDate, setEditNextDate] = useState('')
  const [rowBusyId, setRowBusyId] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  function startEdit(item) {
    setEditingId(item.id)
    setEditName(item.name)
    setEditCategory(item.category)
    setEditAmount(String(Number(item.amount)))
    setEditCurrency(item.currency)
    setEditNextDate(item.next_due_date)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditCategory(categories[0])
    setEditAmount('')
    setEditCurrency(currencies[0])
    setEditNextDate('')
  }

  async function saveEdit() {
    if (!editingId) return
    setRowBusyId(editingId)
    const ok = await onUpdateRecurringExpense(editingId, {
      name: editName,
      category: editCategory,
      amount: editAmount,
      currency: editCurrency,
      frequency: recurringItems.find((item) => item.id === editingId)?.frequency || 'monthly',
      next_due_date: editNextDate,
    })
    setRowBusyId(null)

    if (ok) {
      cancelEdit()
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return
    setRowBusyId(pendingDeleteId)
    await onDeleteRecurringExpense(pendingDeleteId)
    setRowBusyId(null)
    setPendingDeleteId(null)
    if (editingId === pendingDeleteId) {
      cancelEdit()
    }
  }

  return (
    <article className="panel">
      <h2>Recurring Expenses</h2>
      <p className="small-note">Supports weekly, monthly, and yearly auto-generation.</p>

      {fetchingRecurring ? <p className="empty">Loading recurring expenses...</p> : null}

      {recurringItems.length ? (
        <div className="table-wrap recurring-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Next Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurringItems.map((item) => {
                const isEditing = item.id === editingId
                const isBusy = item.id === rowBusyId

                return (
                  <tr key={item.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          type="text"
                          maxLength={80}
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="table-input"
                          value={editCategory}
                          onChange={(event) => setEditCategory(event.target.value)}
                        >
                          {categories.map((categoryOption) => (
                            <option key={categoryOption} value={categoryOption}>
                              {categoryOption}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.category
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="split-field">
                          <input
                            className="table-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editAmount}
                            onChange={(event) => setEditAmount(event.target.value)}
                          />
                          <select className="table-input" value={editCurrency} onChange={(event) => setEditCurrency(event.target.value)}>
                            {currencies.map((currencyOption) => (
                              <option key={currencyOption} value={currencyOption}>
                                {currencyOption}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div>{Number(item.amount).toFixed(2)} {item.currency}</div>
                          {item.currency !== baseCurrency ? (
                            <div className="sub-amount">~ {item.baseAmount.toFixed(2)} {baseCurrency}</div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          type="date"
                          value={editNextDate}
                          onChange={(event) => setEditNextDate(event.target.value)}
                        />
                      ) : (
                        showDate(item.next_due_date)
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <button type="button" disabled={isBusy} onClick={saveEdit}>
                              Save
                            </button>
                            <button type="button" className="ghost-btn" disabled={isBusy} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" disabled={isBusy || Boolean(editingId)} onClick={() => startEdit(item)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-btn"
                              disabled={isBusy || Boolean(editingId)}
                              onClick={() => setPendingDeleteId(item.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No recurring expenses yet.</p>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete Recurring Expense?"
        message="This removes the recurring rule and all expenses generated from it."
        confirmLabel="Delete Rule"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </article>
  )
}

export function Dashboard({
  theme,
  onToggleTheme,
  session,
  summary,
  baseCurrency,
  currencies,
  onBaseCurrencyChange,
  expenseDate,
  category,
  amount,
  description,
  expenseCurrency,
  categories,
  recurringItems,
  fetchingRecurring,
  recurringName,
  recurringCategory,
  recurringAmount,
  recurringCurrency,
  recurringFrequency,
  recurringNextDate,
  searchQuery,
  statsGranularity,
  onExpenseDateChange,
  onCategoryChange,
  onAmountChange,
  onDescriptionChange,
  onExpenseCurrencyChange,
  onAddExpense,
  onRecurringNameChange,
  onRecurringCategoryChange,
  onRecurringAmountChange,
  onRecurringCurrencyChange,
  onRecurringFrequencyChange,
  onRecurringNextDateChange,
  onAddRecurringExpense,
  onDeleteRecurringExpense,
  onUpdateRecurringExpense,
  availableMonths,
  selectedCategory,
  selectedMonth,
  onCategoryFilterChange,
  onMonthFilterChange,
  onSearchQueryChange,
  onStatsGranularityChange,
  onResetFilters,
  fetchingExpenses,
  filteredExpenses,
  categoryChart,
  dateChart,
  periodStats,
  onLogout,
  onUpdateExpense,
  onDeleteExpense,
}) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Expense Tracker Dashboard</h1>
          <p>{session.user.email}</p>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost-btn theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="theme-icon">
                <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2.5v2.3M12 19.2v2.3M21.5 12h-2.3M4.8 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="theme-icon">
                <path
                  d="M20.6 14.2A8.6 8.6 0 1 1 9.8 3.4a7.2 7.2 0 1 0 10.8 10.8Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <select className="ghost-select" value={baseCurrency} onChange={onBaseCurrencyChange}>
            {currencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="ghost-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="summary-grid">
        <SummaryCard title="Total Spent" value={`${summary.total.toFixed(2)} ${baseCurrency}`} />
        <SummaryCard title="This Month" value={`${summary.currentMonthTotal.toFixed(2)} ${baseCurrency}`} />
        <SummaryCard title="Entries" value={String(summary.entries)} />
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>Add New Expense</h2>
          <form className="expense-form" onSubmit={onAddExpense}>
            <label>Date</label>
            <input type="date" value={expenseDate} onChange={onExpenseDateChange} required />

            <label>Category</label>
            <select value={category} onChange={onCategoryChange}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label>Amount</label>
            <div className="split-field">
              <input type="number" min="0.01" step="0.01" value={amount} onChange={onAmountChange} required />
              <select value={expenseCurrency} onChange={onExpenseCurrencyChange}>
                {currencies.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <label>Description (optional)</label>
            <input type="text" maxLength={200} value={description} onChange={onDescriptionChange} />

            <button type="submit">Save Expense</button>
          </form>
        </article>

        <ExpensesPanel
          categories={categories}
          currencies={currencies}
          baseCurrency={baseCurrency}
          availableMonths={availableMonths}
          selectedCategory={selectedCategory}
          selectedMonth={selectedMonth}
          searchQuery={searchQuery}
          onCategoryFilterChange={onCategoryFilterChange}
          onMonthFilterChange={onMonthFilterChange}
          onSearchQueryChange={onSearchQueryChange}
          onResetFilters={onResetFilters}
          fetchingExpenses={fetchingExpenses}
          filteredExpenses={filteredExpenses}
          onUpdateExpense={onUpdateExpense}
          onDeleteExpense={onDeleteExpense}
        />
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>Add Recurring Expense</h2>
          <form className="expense-form" onSubmit={onAddRecurringExpense}>
            <label>Name</label>
            <input type="text" maxLength={80} placeholder="e.g. Rent" value={recurringName} onChange={onRecurringNameChange} required />

            <label>Category</label>
            <select value={recurringCategory} onChange={onRecurringCategoryChange}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label>Amount</label>
            <div className="split-field">
              <input type="number" min="0.01" step="0.01" value={recurringAmount} onChange={onRecurringAmountChange} required />
              <select value={recurringCurrency} onChange={onRecurringCurrencyChange}>
                {currencies.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <label>Frequency</label>
            <select value={recurringFrequency} onChange={onRecurringFrequencyChange}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>

            <label>First / Next Charge Date</label>
            <input type="date" value={recurringNextDate} onChange={onRecurringNextDateChange} required />

            <button type="submit">Save Recurring</button>
          </form>
        </article>

        <RecurringExpensesPanel
          categories={categories}
          currencies={currencies}
          baseCurrency={baseCurrency}
          recurringItems={recurringItems}
          fetchingRecurring={fetchingRecurring}
          onDeleteRecurringExpense={onDeleteRecurringExpense}
          onUpdateRecurringExpense={onUpdateRecurringExpense}
        />
      </section>

      <section className="panel">
        <h2>Spending Graphs</h2>
        {filteredExpenses.length ? (
          <Suspense fallback={<p className="empty">Loading charts...</p>}>
            <SpendingCharts categoryChart={categoryChart} dateChart={dateChart} />
          </Suspense>
        ) : (
          <p className="empty">Add some expenses to see charts.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Statistics</h2>
          <select value={statsGranularity} onChange={onStatsGranularityChange}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        {periodStats.rows.length ? (
          <>
            <div className="monthly-top">
              <p>
                Average per {showPeriodLabel(statsGranularity).toLowerCase()}: <strong>{periodStats.average.toFixed(2)} {baseCurrency}</strong>
              </p>
              {periodStats.best ? (
                <p>
                  Highest {showPeriodLabel(statsGranularity).toLowerCase()}: <strong>{periodStats.best.month}</strong> ({periodStats.best.total.toFixed(2)} {baseCurrency})
                </p>
              ) : null}
            </div>

            <div className="table-wrap monthly-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{showPeriodLabel(statsGranularity)}</th>
                    <th>Total</th>
                    <th>Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {periodStats.rows.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{row.total.toFixed(2)} {baseCurrency}</td>
                      <td>{row.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="empty">No stats yet.</p>
        )}
      </section>
    </main>
  )
}
