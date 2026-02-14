import { supabase } from '../supabase'

export async function getExpenses() {
  return supabase
    .from('expenses')
    .select('id, expense_date, category, amount, currency, description, recurring_expense_id')
    .order('expense_date', { ascending: true })
    .order('created_at', { ascending: true })
}

export async function createExpense(payload) {
  return supabase.from('expenses').insert(payload)
}

export async function editExpense(id, payload) {
  return supabase.from('expenses').update(payload).eq('id', id)
}

export async function removeExpense(id) {
  return supabase.from('expenses').delete().eq('id', id)
}

export async function removeExpensesByRecurringId(recurringExpenseId) {
  return supabase.from('expenses').delete().eq('recurring_expense_id', recurringExpenseId)
}
