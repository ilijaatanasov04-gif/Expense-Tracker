import { AlertBox } from './AlertBox'

export function AuthCard({
  alert,
  authMode,
  email,
  password,
  confirmPassword,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onModeToggle,
}) {
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

        <form onSubmit={onSubmit} className="auth-form">
          <label>Email</label>
          <input type="email" value={email} onChange={onEmailChange} required />

          <label>Password</label>
          <input type="password" value={password} onChange={onPasswordChange} minLength={6} required />

          {authMode === 'signup' ? (
            <>
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={onConfirmPasswordChange}
                minLength={6}
                required
              />
            </>
          ) : null}

          <button type="submit">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
        </form>

        <p className="auth-switch">
          {authMode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
          <button type="button" className="text-link" onClick={onModeToggle}>
            {authMode === 'login' ? 'Create one' : 'Login'}
          </button>
        </p>
      </section>
    </main>
  )
}
