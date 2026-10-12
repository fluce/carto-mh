import { useState, type FormEvent } from 'react';
import { useData } from '../../data/DataContext.ts';

function LoginDialog() {
  const { needsLogin, loginError, loginPending, submitLogin } = useData();
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');

  if (!needsLogin) {
    return <></>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log("Submitting login with ID:", id);
    await submitLogin(id.trim(), secret);
  }

  return (
    <section className="login-panel" aria-labelledby="login-title">
        <h1 id="login-title">Connexion requise</h1>
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
            <span>Mot de passe</span>
            <input
              type="password"
              value={secret}
              onChange={event => setSecret(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={loginPending}>
            {loginPending ? 'Connexion en cours...' : 'Se connecter'}
          </button>
          {loginError && <p role="alert">{loginError}</p>}
        </form>
    </section>
  );
}

export default LoginDialog;