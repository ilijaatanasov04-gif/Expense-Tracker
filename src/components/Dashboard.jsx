import { Suspense, lazy, useMemo, useState } from 'react'
import { AlertBox } from './AlertBox'

const SpendingCharts = lazy(() => import('./SpendingCharts'))

function showDate(yyyyMmDd) {
  return yyyyMmDd
}

function SummaryCard({ title, value }) {
  return (
    <article className="summary-card">
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  )
}

function ExpensesPanel({
  categories,
  availableMonths,
  selectedCategory,
  selectedMonth,
  onCategoryFilterChange,
  onMonthFilterChange,
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
  const [editDescription, setEditDescription] = useState('')
  const [rowBusyId, setRowBusyId] = useState(null)

  const editingItem = useMemo(
    () => filteredExpenses.find((item) => item.id === editingId) || null,
    [filteredExpenses, editingId]
  )

  function startEdit(item) {
    setEditingId(item.id)
    setEditDate(item.expense_date)
    setEditCategory(item.category)
    setEditAmount(String(Number(item.amount)))
    setEditDescription(item.description || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDate('')
    setEditCategory(categories[0])
    setEditAmount('')
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
      description: editDescription,
    })
    setRowBusyId(null)

    if (ok) {
      cancelEdit()
    }
  }

  async function removeItem(id) {
    const confirmed = window.confirm('Delete this expense?')
    if (!confirmed) return

    setRowBusyId(id)
    await onDeleteExpense(id)
    setRowBusyId(null)

    if (editingId === id) {
      cancelEdit()
    }
  }

  return (
    <article className="panel">
      <h2>All Expenses</h2>

      <div className="filter-form">
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
                        <input
                          className="table-input"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editAmount}
                          onChange={(event) => setEditAmount(event.target.value)}
                        />
                      ) : (
                        `${Number(item.amount).toFixed(2)} MKD`
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
                              onClick={() => removeItem(item.id)}
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
    </article>
  )
}

export function Dashboard({
  alert,
  session,
  summary,
  expenseDate,
  category,
  amount,
  description,
  categories,
  onExpenseDateChange,
  onCategoryChange,
  onAmountChange,
  onDescriptionChange,
  onAddExpense,
  availableMonths,
  selectedCategory,
  selectedMonth,
  onCategoryFilterChange,
  onMonthFilterChange,
  onResetFilters,
  fetchingExpenses,
  filteredExpenses,
  categoryChart,
  dateChart,
  monthlyStats,
  onLogout,
  onUpdateExpense,
  onDeleteExpense,
}) {
  return (
    <main className="app-shell">
      {alert ? <AlertBox alert={alert} /> : null}

      <header className="topbar">
        <div>
          <h1>Expense Tracker Dashboard</h1>
          <p>{session.user.email}</p>
        </div>
        <button className="ghost-btn" onClick={onLogout}>
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
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={onAmountChange}
              required
            />

            <label>Description (optional)</label>
            <input type="text" maxLength={200} value={description} onChange={onDescriptionChange} />

            <button type="submit">Save Expense</button>
          </form>
        </article>

        <ExpensesPanel
          categories={categories}
          availableMonths={availableMonths}
          selectedCategory={selectedCategory}
          selectedMonth={selectedMonth}
          onCategoryFilterChange={onCategoryFilterChange}
          onMonthFilterChange={onMonthFilterChange}
          onResetFilters={onResetFilters}
          fetchingExpenses={fetchingExpenses}
          filteredExpenses={filteredExpenses}
          onUpdateExpense={onUpdateExpense}
          onDeleteExpense={onDeleteExpense}
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
        <h2>Monthly Statistics</h2>
        {monthlyStats.rows.length ? (
          <>
            <div className="monthly-top">
              <p>
                Average per month: <strong>{monthlyStats.average.toFixed(2)} MKD</strong>
              </p>
              {monthlyStats.best ? (
                <p>
                  Highest month: <strong>{monthlyStats.best.month}</strong> ({monthlyStats.best.total.toFixed(2)} MKD)
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
