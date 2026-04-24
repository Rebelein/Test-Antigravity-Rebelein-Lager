import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { GlassCard, Button, GlassInput } from '../components/UIComponents';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, User, LogIn, UserPlus, AlertCircle, Database, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { MANUAL_SETUP_SQL } from '../../utils/dbInit';
import { useAuth } from '../../contexts/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // DB Setup States
  const [showSql, setShowSql] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        if (!fullName.trim()) {
            throw new Error("Bitte gib einen Namen ein.");
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (error) throw error;
        setMsg("Registrierung erfolgreich! Du kannst dich nun einloggen.");
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Invalid login credentials")) {
        setError("Login fehlgeschlagen. Ist das Passwort falsch oder hast du deine E-Mail noch nicht bestätigt?");
      } else {
        setError(err.message || "Ein unbekannter Fehler ist aufgetreten.");
      }
      toast.error("Authentifizierung fehlgeschlagen");
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="text-center mb-8 relative z-10">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200">
          Rebelein LagerApp
        </h1>
        <p className="text-muted-foreground mt-2">
          {showSql ? 'Datenbank Setup Code' : (isLogin ? 'Willkommen zurück!' : 'Neuen Benutzerzugang erstellen.')}
        </p>
      </div>

      <GlassCard className="w-full max-w-md relative z-10 p-0 overflow-hidden border border-border shadow-2xl backdrop-blur-sm">
        {!showSql ? (
          <>
            <div className="flex justify-center mb-6 border-b border-border pb-4 pt-6">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(null); setMsg(null); }}
                className={`mx-4 pb-1 text-sm font-medium transition-colors ${
                  isLogin ? 'text-teal-400 border-b-2 border-teal-400' : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                Anmelden
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(null); setMsg(null); }}
                className={`mx-4 pb-1 text-sm font-medium transition-colors ${
                  !isLogin ? 'text-teal-400 border-b-2 border-teal-400' : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                Registrieren
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4 px-6 pb-6">
              
              {!isLogin && (
                 <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-teal-200 mb-2 text-xs uppercase tracking-wider font-bold">
                      <User size={14} /> Anzeigename
                    </div>
                    <GlassInput
                      type="text"
                      name="fullName"
                      placeholder="Max Mustermann"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={!isLogin}
                    />
                 </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-teal-200 mb-2 text-xs uppercase tracking-wider font-bold">
                  <Mail size={14} /> Email
                </div>
                <GlassInput
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                 <div className="flex items-center gap-2 text-teal-200 mb-2 text-xs uppercase tracking-wider font-bold">
                  <Lock size={14} /> Passwort
                </div>
                <GlassInput
                  type="password"
                  name="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 p-3 rounded-lg text-red-200 text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {msg && (
                <div className="bg-primary/20 border border-emerald-500/50 p-3 rounded-lg text-emerald-200 text-sm flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0" />
                  <span>{msg}</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full mt-4 flex items-center justify-center gap-2">
                {loading ? 'Lade...' : isLogin ? <><LogIn size={18}/> Einloggen</> : <><UserPlus size={18}/> Account erstellen</>}
              </Button>
            </form>
          </>
        ) : (
          <div className="p-6 animate-in fade-in zoom-in duration-200">
            <div className="bg-black/40 rounded-xl border border-border p-4 mb-4">
              <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                <Database size={16} /> Initial SQL Setup
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Kopiere diesen Code in den Supabase SQL Editor, um die Datenbank zu reparieren/erstellen.
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  className="w-full h-48 bg-black/50 rounded-lg border border-border p-3 text-[10px] font-mono text-emerald-300/80 focus:outline-none resize-none"
                  value={MANUAL_SETUP_SQL}
                />
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="absolute top-2 right-2 p-1.5 bg-muted hover:bg-muted rounded-md text-white transition-colors"
                >
                  {sqlCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      <div className="mt-6 text-center z-10 w-full max-w-md">
        {/* Emergency DB Init Toggle */}
        <button
          type="button"
          onClick={() => setShowSql(!showSql)}
          className="text-xs text-muted-foreground hover:text-emerald-400/80 flex items-center justify-center gap-1 w-full transition-colors pt-4 border-t border-white/5"
        >
          <Database size={12} />
          <span>{showSql ? 'Zurück zum Login' : 'Datenbank Setup Code anzeigen'}</span>
        </button>
      </div>
    </div>
  );
};

export default Login;
