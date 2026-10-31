import React from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Database, 
  Sun, 
  Moon, 
  LogOut, 
  X, 
  Wifi, 
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { Conversation, UserSession, ADMIN_EMAIL } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  user: UserSession;
  onLogout: () => void;
  activeTab: 'chat' | 'knowledge';
  onNavigateTab: (tab: 'chat' | 'knowledge') => void;
  knowledgeCount: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  user,
  onLogout,
  activeTab,
  onNavigateTab,
  knowledgeCount,
  isDarkMode,
  onToggleDarkMode,
  isOpenMobile,
  onCloseMobile,
}) => {
  // CRITICAL: Strictly verify that ONLY gekosamu07@gmail.com is administrator.
  const isAdmin = user.role === 'admin' && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FAF8F5] dark:bg-stone-900 text-stone-800 dark:text-stone-100 select-none border-r border-stone-200/70 dark:border-stone-800">
      {/* Brand Header - Apple Warm Clean */}
      <div className="p-4 sm:p-5 border-b border-stone-200/60 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Wifi className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-semibold text-base tracking-tight text-stone-900 dark:text-stone-100 leading-tight">
                Super Redes
              </h1>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100/70 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-800 text-[9px] font-semibold text-amber-800 dark:text-amber-300">
                {isAdmin ? 'Admin' : 'Asistente'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-normal">
              {isAdmin ? 'Panel de Administración' : 'Soporte Técnico'}
            </p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="p-1.5 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 md:hidden cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* New conversation button */}
      <div className="p-3 sm:p-4 border-b border-stone-200/60 dark:border-stone-800">
        <button
          type="button"
          onClick={() => {
            onNewConversation();
            onNavigateTab('chat');
            onCloseMobile();
          }}
          className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 font-medium text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2]" />
          <span>Nueva conversación</span>
        </button>
      </div>

      {/* Navigation for Knowledge base - STRICTLY VISIBLE ONLY FOR ADMIN */}
      {isAdmin && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => {
              onNavigateTab(activeTab === 'knowledge' ? 'chat' : 'knowledge');
              onCloseMobile();
            }}
            className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'knowledge'
                ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/25 font-semibold shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Base de conocimiento</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-stone-800 text-[10px] font-semibold text-amber-900 dark:text-amber-300">
              {knowledgeCount}
            </span>
          </button>
        </div>
      )}

      {/* Conversations History */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div className="px-2 py-1 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Conversaciones
          </span>
          <span className="text-[10px] text-stone-400 font-normal">{conversations.length}</span>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-8 px-3">
            <MessageSquare className="w-5 h-5 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
            <p className="text-xs text-stone-400 dark:text-stone-500 font-normal">
              Sin conversaciones aún. Inicia tu primera consulta.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeTab === 'chat' && conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  onNavigateTab('chat');
                  onCloseMobile();
                }}
                className={`group min-h-[38px] px-3 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/10 dark:bg-amber-500/15 text-stone-900 dark:text-stone-100 font-semibold border border-amber-500/20 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 font-normal'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'}`} />
                  <span className="truncate">{conv.title || 'Nueva conversación'}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => onDeleteConversation(conv.id, e)}
                  title="Eliminar conversación"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Area: Dark mode + User profile + Logout */}
      <div className="p-3 border-t border-stone-200/60 dark:border-stone-800 space-y-2 bg-[#F5F2EC]/40 dark:bg-stone-900/60">
        {/* Dark Mode toggle */}
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="w-full min-h-[36px] flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-normal text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {isDarkMode ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-600" />}
            <span>{isDarkMode ? 'Modo Oscuro' : 'Modo Claro'}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
            Cambiar
          </span>
        </button>

        {/* User Profile Card */}
        <div className="p-2.5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750 shadow-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                {user.name}
              </p>
              <div className="inline-flex items-center gap-1 text-[10px] font-medium">
                {isAdmin ? (
                  <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>Administrador</span>
                  </span>
                ) : (
                  <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 shrink-0" />
                    <span>Asistente Técnico</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="w-68 shrink-0 h-full hidden md:block">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-out Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer content */}
          <div className="relative w-[85%] max-w-xs h-full bg-[#FAF8F5] dark:bg-stone-900 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
