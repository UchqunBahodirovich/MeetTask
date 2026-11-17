import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, User as UserIcon, Building2, Loader2, Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import { LANGUAGES } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { getPublicCopy } from '../i18n/public';
import type { Language } from '../types';
import { ApiError } from '../services/api';
import { Select } from '../components/ui/Select';
import { TaskGraph, Wordmark } from './Landing';
import './landing.css';

export const AuthPage: React.FC<{ language: Language; onLanguageChange: (language: Language) => void }> = ({ language, onLanguageChange }) => {
  const { t } = useI18n();
  const c = getPublicCopy(language);
  const { login, register, loginWithGoogle } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setIsGoogleBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      // Closing the popup is a normal thing to do, not an error worth showing.
      const code = (err as { code?: string })?.code ?? '';
      if (!code.includes('popup-closed') && !code.includes('cancelled-popup')) {
        setError(c.authGoogleError);
      }
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsBusy(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          workspaceName: workspaceName.trim(),
        });
      }
    } catch (err) {
      if (isLogin && err instanceof ApiError && err.status === 401) setError(c.authInvalidCredentials);
      else setError(isLogin ? c.authLoginError : c.authRegistrationError);
    } finally {
      setIsBusy(false);
    }
  };

  const field = (id: string, label: string, icon: React.ReactNode, input: React.ReactNode) => (
    <div className="lp-auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="lp-auth-input">{icon}{input}</div>
    </div>
  );

  // Same design system as the landing page: tokens, type, glass pills, bracket frames.
  return (
    <div className="mt-landing lp-auth">
      <nav className="lp-nav" aria-label={c.navAria}>
        <a className="lp-glass lp-nav-logo" href="#/landing" aria-label={c.home}><Wordmark /></a>
        <div className="lp-glass lp-nav-actions lp-auth-actions">
          <label className="sr-only" htmlFor="auth-language">{c.language}</label>
          <Select id="auth-language" value={language} onChange={onLanguageChange} options={LANGUAGES.map(item => ({ value: item.code, label: item.label }))} align="right" className="lp-language" panelClassName="lp-select-panel" />
          <button type="button" className="lp-nav-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? c.themeLight : c.themeDark} title={theme === 'dark' ? c.themeLight : c.themeDark}>
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
          </button>
        </div>
      </nav>

      <main className="lp-auth-main">
        <section className="lp-auth-story" aria-hidden="true">
          <h2>{c.hero[0]}<br /><span>{c.hero[1]}</span></h2>
          <TaskGraph c={c} />
        </section>

        <section className="lp-auth-panel">
          <div className="lp-auth-card">
            <h1>{isLogin ? t.auth.logIn : t.auth.createAccount}</h1>
            <p className="lp-auth-lede">{isLogin ? t.auth.loginSubtitle : t.auth.signupSubtitle}</p>

            <button type="button" onClick={handleGoogle} disabled={isGoogleBusy || isBusy} className="lp-btn lp-btn-dashed lp-auth-wide">
              {isGoogleBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3 0-5.6-2-6.6-4.8H1.4v3A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.4 14.5a7.2 7.2 0 0 1 0-4.6v-3H1.4a12 12 0 0 0 0 10.6l4-3Z" />
                  <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.600 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.9l4 3C6.4 7.1 9 4.8 12 4.8Z" />
                </svg>
              )}
              {t.auth.continueGoogle}
            </button>

            <div className="lp-auth-divider"><span>{t.auth.orEmail}</span></div>

            <form className="lp-auth-form" onSubmit={handleSubmit}>
              {!isLogin && <>
                {field('auth-name', t.team.name, <UserIcon aria-hidden="true" />,
                  <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.team.namePlaceholder} autoComplete="name" required />)}
                {field('auth-workspace', t.settings.team, <Building2 aria-hidden="true" />,
                  <input id="auth-workspace" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="MeetTask" autoComplete="organization" required />)}
              </>}
              {field('auth-email', t.auth.email, <Mail aria-hidden="true" />,
                <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" required />)}
              {field('auth-password', t.auth.password, <Lock aria-hidden="true" />,
                <input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={8} required />)}

              {error && <p role="alert" className="lp-auth-error">{error}</p>}

              <button type="submit" disabled={isBusy} className="lp-btn lp-btn-solid lp-auth-wide">
                {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLogin ? t.auth.logIn : t.auth.createAccount}
                {!isBusy && <ArrowRight className="w-4 h-4" strokeWidth={1.75} />}
              </button>
            </form>
          </div>

          <p className="lp-auth-switch">
            {isLogin ? t.auth.noAccount : t.auth.haveAccount}{' '}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
              {isLogin ? t.auth.signUp : t.auth.logInLink}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
};
