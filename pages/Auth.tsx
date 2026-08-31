import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { Video, Mail, Lock, ArrowRight, Github } from 'lucide-react';

interface AuthPageProps {
  onLogin: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 mb-6">
            <Video className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">MeetTask AI</h1>
          <p className="text-slate-500 mt-2">
            {isLogin ? t.auth.loginSubtitle : t.auth.signupSubtitle}
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6">
          <div className="space-y-4">
            <button 
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
              {t.auth.continueGoogle}
            </button>
            <button 
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <Github className="w-4 h-4" />
              {t.auth.continueGithub}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">{t.auth.orEmail}</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t.auth.email}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-sm outline-none transition-all"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t.auth.password}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-sm outline-none transition-all"
                  required
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 group"
            >
              {isLogin ? t.auth.logIn : t.auth.createAccount}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          {isLogin ? t.auth.noAccount : t.auth.haveAccount}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="font-bold text-blue-600 hover:text-blue-700"
          >
            {isLogin ? t.auth.signUp : t.auth.logInLink}
          </button>
        </p>
      </div>
    </div>
  );
};
