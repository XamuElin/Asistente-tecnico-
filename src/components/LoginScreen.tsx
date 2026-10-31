import React, { useState } from 'react';
import { Wifi, AlertCircle, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { UserSession } from '../types';

export const ADMIN_EMAIL = 'gekosamu07@gmail.com';

interface LoginScreenProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = (user.email || '').toLowerCase().trim();

      // Check that email is verified in Google Account
      if (!user.emailVerified) {
        await signOut(auth);
        setErrorMessage(
          `Acceso denegado: Tu cuenta de Google (${email}) no tiene el correo electrónico verificado.`
        );
        setIsLoading(false);
        return;
      }

      // CRITICAL: Strictly ensure ONLY gekosamu07@gmail.com is administrator.
      // All companions and colleagues who log in are strictly assigned as 'advisor' (Asistente).
      const isAdmin = email === ADMIN_EMAIL.toLowerCase().trim();

      const session: UserSession = {
        id: user.uid,
        name: user.displayName || email.split('@')[0],
        email: email,
        role: isAdmin ? 'admin' : 'advisor',
        avatarUrl: user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      };

      onLoginSuccess(session);
    } catch (err: any) {
      console.error('Error signing in with Google:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err?.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#FAF8F5] dark:bg-stone-950 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-amber-500/20 selection:text-amber-900 transition-colors">
      <div className="w-full max-w-[420px] bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-stone-200/80 dark:border-stone-800 p-8 sm:p-10 space-y-7">
        
        {/* Brand Header - Apple Warm Clean Style */}
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 mx-auto">
            <Wifi className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-[26px] font-semibold text-stone-900 dark:text-stone-50 tracking-tight">
              Super Redes
            </h1>
            <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">
              Asistente para Asesores Técnicos
            </p>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-[280px] mx-auto">
            Plataforma de soporte con respuestas inmediatas basada en documentación técnica oficial.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="space-y-0.5">
              <p className="font-semibold">Acceso restringido</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Google Sign In Button */}
        <div className="space-y-3.5 pt-1">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full min-h-[48px] flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-100 border border-stone-300/80 dark:border-stone-700 font-medium text-sm shadow-xs hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </>
            )}
          </button>

          <div className="rounded-xl bg-stone-50 dark:bg-stone-850 p-3 border border-stone-200/50 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Acceso seguro con control de roles</span>
            </div>
            <p className="leading-relaxed">
              Los compañeros y asesores acceden con rol de <span className="font-semibold text-stone-700 dark:text-stone-300">Asistente</span> para consultas técnicas. La administración de documentos está reservada exclusivamente para la cuenta principal.
            </p>
          </div>
        </div>

        <div className="text-center text-[11px] text-stone-400 dark:text-stone-500 pt-2 border-t border-stone-100 dark:border-stone-800">
          Super Redes • Soporte Técnico Interno
        </div>
      </div>
    </div>
  );
};
