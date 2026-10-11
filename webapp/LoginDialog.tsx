import { useState, type FormEvent } from 'react';
import { useData } from './DataContext.ts';

function LoginDialog() {
  const { needsLogin, loginError, loginPending, submitLogin } = useData();
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');

  if (!needsLogin) {
    return <></>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitLogin(id.trim(), secret);
  }

  return (
    <div className="login-backdrop">
      <dialog open className="login-dialog" aria-labelledby="login-title">
        <h1 id="login-title">Login required</h1>
        <form onSubmit={handleSubmit}>
          <label>
            <span>ID</span>
            <input
              type="text"
              value={id}
              onChange={event => setId(event.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={secret}
              onChange={event => setSecret(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={loginPending}>
            {loginPending ? 'Logging in...' : 'Log in'}
          </button>
          {loginError && <p role="alert">{loginError}</p>}
        </form>
      </dialog>
    </div>
  );
}

export default LoginDialog;