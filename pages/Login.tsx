
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { GlassCard, Button, GlassInput } from '../src/components/UIComponents';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Loader2, AlertCircle, Database, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { initializeDatabase, MANUAL_SETUP_SQL } from '../utils/dbInit';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth(); // Zugriff auf aktuellen Session-Status
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  // DB Setup States
  const [showSql, setShowSql] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Wenn Benutzer bereits eingeloggt ist (z.B. durch persistierte Session), direkt weiterleiten
  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        alert('Registrierung erfolgreich! Du wirst nun eingeloggt.');
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message);
      toast.error("Login fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
    } finally {
      setLoading(false);
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(MANUAL_SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-900 p-4 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-teal-600/20 rounded-full blur-[100px] pointer-events-none" />

      <GlassCard className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200 mb-2">
            Rebelein LagerApp
          </h1>
          <p className="text-white/50">
            {isLogin ? 'Willkommen zurück! Bitte einloggen.' : 'Neuen Benutzerzugang erstellen.'}
          </p>
        </div>

        {!showSql ? (
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <GlassInput
                icon={<User size={20} />}
                name="fullName"
                id="fullName"
                placeholder="Voller Name (z.B. Max Mustermann)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            )}

            <GlassInput
              icon={<Mail size={20} />}
              type="email"
              name="email"
              id="email"
              placeholder="E-Mail Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username email"
            />

            <GlassInput
              icon={<Lock size={20} />}
              type="password"
              name="password"
              id="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-6"
              disabled={loading}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : (isLogin ? 'Einloggen' : 'Registrieren')}
            </Button>
          </form>
        ) : (
          <div className="animate-in fade-in zoom-in duration-200">
            <div className="bg-black/40 rounded-xl border border-white/10 p-4 mb-4">
              <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                <Database size={16} /> Initial SQL Setup
              </h3>
              <p className="text-xs text-white/60 mb-3">
                Kopiere diesen Code in den Supabase SQL Editor, um die Datenbank zu reparieren/erstellen.
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  className="w-full h-48 bg-black/50 rounded-lg border border-white/10 p-3 text-[10px] font-mono text-emerald-300/80 focus:outline-none resize-none"
                  value={MANUAL_SETUP_SQL}
                />
                <button
                  onClick={copySqlToClipboard}
                  className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors"
                >
                  {sqlCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-center space-y-4">
          {!showSql && (
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-white/60 hover:text-emerald-300 transition-colors block w-full"
            >
              {isLogin ? 'Noch keinen Account? Registrieren' : 'Bereits einen Account? Einloggen'}
            </button>
          )}

          {/* Emergency DB Init Toggle */}
          <button
            onClick={() => setShowSql(!showSql)}
            className="text-xs text-white/20 hover:text-emerald-400/80 flex items-center justify-center gap-1 w-full transition-colors pt-4 border-t border-white/5"
          >
            <Database size={12} />
            <span>{showSql ? 'Zurück zum Login' : 'Datenbank Setup Code anzeigen'}</span>
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default Login;
