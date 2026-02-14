import { supabase } from '../supabase'

export async function getRecurringExpenses() {
  return supabase
    .from('recurring_expenses')
    .select('id, name, category, amount, currency, frequency, next_due_date')
    .order('created_at', { ascending: true })
}

export async function createRecurringExpense(payload) {
  return supabase.from('recurring_expenses').insert(payload)
}

export async function updateRecurringExpense(id, payload) {
  return supabase.from('recurring_expenses').update(payload).eq('id', id)
}

export async function removeRecurringExpense(id) {
  return supabase.from('recurring_expenses').delete().eq('id', id)
}
