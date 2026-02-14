import { supabase } from '../supabase'

export async function getExpenses() {
  return supabase
    .from('expenses')
    .select('id, expense_date, category, amount, description, created_at')
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
