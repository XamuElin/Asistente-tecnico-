import React, { useState } from 'react';
import { UserCheck, Shield, User, X } from 'lucide-react';
import { UserSession, UserRole } from '../types';

interface AuthModalProps {
  user: UserSession;
  onUpdateUser: (updated: UserSession) => void;
  onClose: () => void;
}

import { ADMIN_EMAIL } from '../types';

export const AuthModal: React.FC<AuthModalProps> = ({ user, onUpdateUser, onClose }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const isActualAdmin = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase().trim();
  const [role, setRole] = useState<UserRole>(isActualAdmin ? 'admin' : 'advisor');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmail = email.trim().toLowerCase() || user.email.toLowerCase();
    const isOwner = finalEmail === ADMIN_EMAIL.toLowerCase().trim();
    onUpdateUser({
      ...user,
      name: name.trim() || user.name,
      email: finalEmail,
      role: isOwner ? role : 'advisor',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Perfil de Asesor Técnico
              </h3>
              <p className="text-xs text-slate-500">Super Redes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Correo Corporativo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Rol en el Sistema
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('advisor')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  role === 'advisor'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-xs font-bold">Asesor Técnico</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Consulta de información y chat
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  role === 'admin'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-bold">Administrador</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Acceso a gestión de archivos
                </p>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-xs cursor-pointer active:scale-95"
            >
              Guardar perfil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
