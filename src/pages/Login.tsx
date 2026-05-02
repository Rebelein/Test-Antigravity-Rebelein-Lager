import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { GlassCard, Button, GlassInput } from '../components/UIComponents';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, User, LogIn, UserPlus, AlertCircle, Database, Copy, Check, Package } from 'lucide-react';
import { toast } from 'sonner';
import { MANUAL_SETUP_SQL } from '../../utils/dbInit';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';

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
    <div className="bg-[#0A0D14] relative min-h-screen overflow-hidden text-white font-sans">
      {/* Background Gradients (Teal/Emerald Theme instead of Rose) */}
      <div className="absolute -top-10 left-0 h-1/2 w-full rounded-b-full bg-gradient-to-b from-[#0A0D14] to-transparent blur z-0"></div>
      <div className="absolute -top-64 left-0 h-1/2 w-full rounded-full bg-gradient-to-b from-teal-500/20 via-emerald-500/10 to-transparent blur-3xl z-0 pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-teal-900/40 to-transparent blur-[120px] z-0 pointer-events-none"></div>

      <div className="relative z-10 grid min-h-screen grid-cols-1 md:grid-cols-2">
        {/* Left Side - Illustration / Branding */}
        <motion.div
          className="hidden flex-1 items-center justify-center space-y-8 p-8 text-center md:flex flex-col"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="space-y-6 w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="flex justify-center"
            >
                {/* Fallback Icon if no illustration is available */}
                <div className="w-48 h-48 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 rounded-[3rem] border border-white/10 flex items-center justify-center shadow-2xl shadow-teal-500/10">
                   <Package size={80} className="text-teal-400 drop-shadow-lg" />
                </div>
            </motion.div>
            <motion.h1
              className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            >
              Rebelein LagerApp
            </motion.h1>
            <motion.p
              className="text-muted-foreground text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            >
              Die moderne Lösung für Kommissionen, Maschinenverleih und Materialwirtschaft.
            </motion.p>
          </div>
        </motion.div>

        {/* Right Side - Login Form */}
        <motion.div
          className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <GlassCard className="border-border/50 bg-card/40 w-full shadow-[0_10px_40px_-10px_rgba(20,184,166,0.15)] backdrop-blur-xl p-0 overflow-hidden">
                {!showSql ? (
                    <>
                        {/* Tabs (Login / Register) */}
                        <div className="flex justify-center mb-2 border-b border-border/50 pb-0 pt-2 bg-black/20">
                            <button
                                type="button"
                                onClick={() => { setIsLogin(true); setError(null); setMsg(null); }}
                                className={`flex-1 py-4 text-sm font-bold transition-all relative ${
                                isLogin ? 'text-teal-400' : 'text-muted-foreground hover:text-white'
                                }`}
                            >
                                Anmelden
                                {isLogin && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsLogin(false); setError(null); setMsg(null); }}
                                className={`flex-1 py-4 text-sm font-bold transition-all relative ${
                                !isLogin ? 'text-teal-400' : 'text-muted-foreground hover:text-white'
                                }`}
                            >
                                Registrieren
                                {!isLogin && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
                            </button>
                        </div>

                        <div className="space-y-6 p-8 pt-6">
                            {/* Header */}
                            <motion.div
                                className="space-y-2 text-center mb-6"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.3 }}
                            >
                                <h2 className="text-2xl font-bold tracking-tight text-white">
                                    {isLogin ? 'Willkommen zurück' : 'Account erstellen'}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    {isLogin ? 'Bitte logge dich mit deinen Daten ein.' : 'Registriere dich für den Zugang zur LagerApp.'}
                                </p>
                            </motion.div>

                            <form onSubmit={handleAuth} className="space-y-4">
                                {!isLogin && (
                                    <motion.div
                                        className="space-y-1.5"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        <label className="text-xs font-bold text-teal-200/70 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                                            <User size={12} /> Anzeigename
                                        </label>
                                        <GlassInput
                                            type="text"
                                            name="fullName"
                                            placeholder="Max Mustermann"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            required={!isLogin}
                                        />
                                    </motion.div>
                                )}

                                <motion.div
                                    className="space-y-1.5"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.4 }}
                                >
                                    <label className="text-xs font-bold text-teal-200/70 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                                        <Mail size={12} /> E-Mail
                                    </label>
                                    <GlassInput
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        placeholder="name@beispiel.de"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </motion.div>

                                <motion.div
                                    className="space-y-1.5"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.5 }}
                                >
                                    <label className="text-xs font-bold text-teal-200/70 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                                        <Lock size={12} /> Passwort
                                    </label>
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
                                </motion.div>

                                {error && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-300 text-sm flex items-start gap-2 shadow-inner">
                                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                        <span>{error}</span>
                                    </motion.div>
                                )}

                                {msg && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-teal-500/10 border border-teal-500/30 p-3 rounded-xl text-teal-300 text-sm flex items-start gap-2 shadow-inner">
                                        <Check size={16} className="mt-0.5 shrink-0" />
                                        <span>{msg}</span>
                                    </motion.div>
                                )}

                                {/* Continue Button */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.6 }}
                                    className="pt-2"
                                >
                                    <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-base shadow-lg shadow-teal-500/20 border-none transition-all active:scale-[0.98]">
                                        {loading ? <span className="animate-pulse">Lade...</span> : (isLogin ? 'Einloggen' : 'Account erstellen')}
                                    </Button>
                                </motion.div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="p-8 animate-in fade-in zoom-in duration-200">
                        <div className="bg-black/60 rounded-2xl border border-white/10 p-5 mb-2 shadow-inner">
                            <h3 className="text-teal-400 font-bold mb-2 flex items-center gap-2 text-lg">
                                <Database size={18} /> Initial SQL Setup
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Kopiere diesen Code in den Supabase SQL Editor, um die Datenbank zu reparieren oder neu zu erstellen.
                            </p>
                            <div className="relative">
                                <textarea
                                    readOnly
                                    className="w-full h-64 bg-black/80 rounded-xl border border-white/5 p-4 text-[11px] font-mono text-teal-200/80 focus:outline-none resize-none custom-scrollbar"
                                    value={MANUAL_SETUP_SQL}
                                />
                                <button
                                    type="button"
                                    onClick={copySqlToClipboard}
                                    className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg text-white transition-colors border border-white/10 shadow-lg"
                                >
                                    {sqlCopied ? <Check size={16} className="text-teal-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </GlassCard>

            {/* Terms / Setup Footer */}
            <motion.div
               className="mt-6 text-center w-full"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.5, delay: 0.8 }}
            >
                <button
                    type="button"
                    onClick={() => setShowSql(!showSql)}
                    className="text-xs font-medium text-muted-foreground hover:text-teal-400 flex items-center justify-center gap-1.5 w-full transition-colors mx-auto"
                >
                    <Database size={12} />
                    <span>{showSql ? 'Zurück zum Login' : 'Datenbank Setup (Entwickler)'}</span>
                </button>
            </motion.div>

          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
