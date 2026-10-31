import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, validateFirestoreConnection } from './firebase';
import { 
  ChatMessage, 
  KnowledgeItem, 
  Conversation, 
  UserSession, 
  UnansweredQuestion,
  ADMIN_EMAIL,
  AttachedFileInfo
} from './types';
import { 
  getAllConversations, 
  saveConversation, 
  deleteConversation 
} from './utils/db';
import { 
  subscribeKnowledgeItems, 
  uploadAndSaveKnowledgeFile, 
  updateKnowledgeItemMeta,
  updateKnowledgeItemContent,
  saveKnowledgeLink, 
  deleteKnowledgeItemFromFirestore, 
  clearAllKnowledgeFromFirestore,
  logUnansweredQuestion, 
  subscribeUnansweredQuestions, 
  deleteUnansweredQuestion, 
  seedInitialKnowledgeIfEmpty 
} from './services/knowledgeService';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { LoginScreen } from './components/LoginScreen';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestion[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('super_redes_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('super_redes_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('super_redes_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  // 1. Firebase Auth State Listener & Connection check (Only verified Google accounts can enter)
  useEffect(() => {
    validateFirestoreConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        const email = fbUser.email.toLowerCase().trim();

        // Enforce that email is verified in Google Account
        if (fbUser.emailVerified) {
          // The ONE and ONLY administrator is fixed in code: gekosamu07@gmail.com
          const isAdmin = email === ADMIN_EMAIL.toLowerCase().trim();

          const session: UserSession = {
            id: fbUser.uid,
            name: fbUser.displayName || email.split('@')[0],
            email: email,
            role: isAdmin ? 'admin' : 'advisor',
            avatarUrl: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          };
          setUser(session);
          localStorage.setItem('super_redes_session', JSON.stringify(session));
        } else {
          // Unverified email accounts cannot enter
          await signOut(auth);
          setUser(null);
          localStorage.removeItem('super_redes_session');
        }
      } else {
        setUser(null);
        localStorage.removeItem('super_redes_session');
      }
      setIsInitializing(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Real-time Firestore Subscriptions (Only active when authenticated and initialized)
  useEffect(() => {
    if (isInitializing || !user) return;

    // A. Knowledge Items
    const unsubKnowledge = subscribeKnowledgeItems((items) => {
      setKnowledgeItems(items);
    });

    // B. Unanswered questions log: ONLY subscribe if user is administrator (gekosamu07@gmail.com)
    let unsubUnanswered = () => {};
    if (user.role === 'admin') {
      unsubUnanswered = subscribeUnansweredQuestions((questions) => {
        setUnansweredQuestions(questions);
      });
    }

    // C. Load local conversations history
    getAllConversations().then(stored => {
      if (stored.length > 0) {
        setConversations(stored);
        setActiveConversationId(stored[0].id);
      } else {
        const initialConv: Conversation = {
          id: `conv-${Date.now()}`,
          title: 'Consulta inicial',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveConversation(initialConv);
        setConversations([initialConv]);
        setActiveConversationId(initialConv.id);
      }
    });

    return () => {
      unsubKnowledge();
      unsubUnanswered();
    };
  }, [user?.email, user?.role, isInitializing]);

  // Security guard: advisors cannot view or stay in knowledge management
  useEffect(() => {
    if (user && user.role !== 'admin' && activeTab === 'knowledge') {
      setActiveTab('chat');
    }
  }, [user?.role, activeTab]);

  // Active conversation and messages
  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0] || null;
  const currentMessages = activeConversation ? activeConversation.messages : [];

  const handleNewConversation = async () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: 'Nueva conversación',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveConversation(newConv);
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setActiveTab('chat');
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteConversation(id);
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    if (activeConversationId === id) {
      if (updated.length > 0) {
        setActiveConversationId(updated[0].id);
      } else {
        await handleNewConversation();
      }
    }
  };

  // Chat message sending
  const handleSendMessage = async (queryText: string, attachedFile?: AttachedFileInfo) => {
    if ((!queryText.trim() && !attachedFile) || isLoading || !user) return;

    const displayPrompt = queryText.trim() || (attachedFile ? `Lee y analiza el documento: ${attachedFile.name}` : '');

    let targetConv = activeConversation;
    if (!targetConv) {
      targetConv = {
        id: `conv-${Date.now()}`,
        title: displayPrompt.slice(0, 36),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: displayPrompt,
      timestamp: Date.now(),
      attachedFile: attachedFile ? {
        name: attachedFile.name,
        fileType: attachedFile.fileType,
        size: attachedFile.size,
        thumbnail: attachedFile.thumbnail,
      } : undefined,
    };

    const updatedTitle = targetConv.messages.length === 0 
      ? displayPrompt.slice(0, 36) + (displayPrompt.length > 36 ? '...' : '')
      : targetConv.title;

    const convWithUser: Conversation = {
      ...targetConv,
      title: updatedTitle,
      messages: [...targetConv.messages, userMsg],
      updatedAt: Date.now(),
    };

    setConversations(prev => prev.map(c => c.id === convWithUser.id ? convWithUser : c));
    await saveConversation(convWithUser);
    setIsLoading(true);

    try {
      const historyPayload = targetConv.messages.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      // Obtain current Firebase ID token to verify on backend before calling Gemini
      let idToken = '';
      if (auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch (e) {
          console.warn('Could not get idToken from current user', e);
        }
      }
      if (!idToken && user.email) {
        idToken = `dev-token:${user.email}`;
      }

      // Server-side Gemini request with authentication token, attached file and latest Firestore knowledge base
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          message: displayPrompt,
          history: historyPayload,
          documents: knowledgeItems,
          attachedFile: attachedFile ? {
            name: attachedFile.name,
            fileType: attachedFile.fileType,
            mimeType: attachedFile.mimeType,
            base64: attachedFile.base64,
            text: attachedFile.text,
          } : undefined,
          idToken,
          userEmail: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle rate limit kindly
        if (response.status === 429) {
          const friendlyMessage = errorData.error || 'Has alcanzado el límite de preguntas por hora. Por favor tómate un descanso y vuelve a consultar en unos minutos. 😊';
          const rateMsg: ChatMessage = {
            id: `msg-${Date.now()}-ratelimit`,
            role: 'assistant',
            text: friendlyMessage,
            source: null,
            timestamp: Date.now(),
            isRateLimited: true,
          };
          const finalConv: Conversation = {
            ...convWithUser,
            messages: [...convWithUser.messages, rateMsg],
            updatedAt: Date.now(),
          };
          setConversations(prev => prev.map(c => c.id === finalConv.id ? finalConv : c));
          await saveConversation(finalConv);
          setIsLoading(false);
          return;
        }

        throw new Error(errorData.error || `Error del servidor (${response.status})`);
      }

      const data = await response.json();
      const replyFull = data.reply || 'No encontré esa información en la base de conocimiento, consulta con tu supervisor';
      const source = data.source || null;

      // Check if unanswered to log for administrator review
      if (replyFull.includes('No encontré esa información en la base de conocimiento')) {
        await logUnansweredQuestion(queryText, user.email);
      }

      // Progressive streaming simulation
      const assistantMsgId = `msg-${Date.now()}-assistant`;
      const initialAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        text: '',
        source,
        timestamp: Date.now(),
        contingency: !!data.contingency,
        isStreaming: true,
        relatedMedia: data.relatedMedia || [],
      };

      const convWithStreaming: Conversation = {
        ...convWithUser,
        messages: [...convWithUser.messages, initialAssistantMsg],
        updatedAt: Date.now(),
      };
      setConversations(prev => prev.map(c => c.id === convWithStreaming.id ? convWithStreaming : c));
      setIsLoading(false);

      // Fast, fluid chunk streaming
      const totalLen = replyFull.length;
      const chunkSize = Math.max(4, Math.floor(totalLen / 30));
      let currentIdx = 0;
      while (currentIdx < totalLen) {
        currentIdx = Math.min(currentIdx + chunkSize, totalLen);
        const partial = replyFull.slice(0, currentIdx);
        setConversations(prev => prev.map(c => {
          if (c.id !== convWithStreaming.id) return c;
          return {
            ...c,
            messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, text: partial } : m),
          };
        }));
        await new Promise(r => setTimeout(r, 16));
      }

      // Finalize
      const finalAssistantMsg: ChatMessage = {
        ...initialAssistantMsg,
        text: replyFull,
        isStreaming: false,
        relatedMedia: data.relatedMedia || [],
      };

      const finalConv: Conversation = {
        ...convWithUser,
        messages: [...convWithUser.messages, finalAssistantMsg],
        updatedAt: Date.now(),
      };

      setConversations(prev => prev.map(c => c.id === finalConv.id ? finalConv : c));
      await saveConversation(finalConv);

    } catch (error: any) {
      console.error('Error in chat request:', error);
      setIsLoading(false);

      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        text: error?.message || 'Hubo un error de conexión con la base de conocimiento.',
        source: null,
        timestamp: Date.now(),
        isError: true,
      };

      const finalConv: Conversation = {
        ...convWithUser,
        messages: [...convWithUser.messages, errorMsg],
        updatedAt: Date.now(),
      };
      setConversations(prev => prev.map(c => c.id === finalConv.id ? finalConv : c));
      await saveConversation(finalConv);
    }
  };

  // Knowledge base actions
  const handleUploadFile = async (
    file: File, 
    category: string, 
    existingItem?: KnowledgeItem,
    title?: string,
    description?: string,
    onProgress?: (percent: number, status: string) => void
  ) => {
    if (!user) return;
    await uploadAndSaveKnowledgeFile({
      file,
      category,
      userEmail: user.email,
      title,
      description,
      existingItemId: existingItem?.id,
      existingCreatedAt: existingItem?.createdAt,
      existingCreatedBy: existingItem?.createdBy,
      onProgress,
    });
  };

  const handleEditItem = async (item: KnowledgeItem, newName: string, newCategory: string) => {
    if (!user) return;
    await updateKnowledgeItemMeta({
      item,
      newName,
      newCategory,
      userEmail: user.email,
    });
  };

  const handleSaveLink = async (title: string, url: string, category: string, content: string) => {
    if (!user) return;
    await saveKnowledgeLink({
      title,
      url,
      category,
      content,
      userEmail: user.email,
    });
  };

  const handleDeleteItem = async (item: KnowledgeItem) => {
    if (!user) return;
    await deleteKnowledgeItemFromFirestore(item, user.email);
  };

  const handleClearAllKnowledge = async () => {
    if (!user) return;
    await clearAllKnowledgeFromFirestore(knowledgeItems, user.email);
  };

  const handleUpdateItemContent = async (item: KnowledgeItem, newContent: string) => {
    if (!user) return;
    await updateKnowledgeItemContent(item.id, newContent, user.email);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error', e);
    }
    setUser(null);
    localStorage.removeItem('super_redes_session');
    setActiveTab('chat');
  };

  if (isInitializing) {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF8F5] dark:bg-stone-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-stone-600 dark:text-stone-300">
          <div className="w-9 h-9 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium text-sm text-stone-700 dark:text-stone-300">Iniciando Super Redes...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, show corporate login screen
  if (!user) {
    return (
      <LoginScreen 
        onLoginSuccess={(loggedInUser) => {
          const isOfficialAdmin = loggedInUser.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
          const cleanUser: UserSession = {
            ...loggedInUser,
            role: isOfficialAdmin ? 'admin' : 'advisor',
          };
          setUser(cleanUser);
          localStorage.setItem('super_redes_session', JSON.stringify(cleanUser));
        }} 
      />
    );
  }

  const isUserAdmin = user.role === 'admin' && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden bg-[#FAF8F5] dark:bg-stone-950 font-sans transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setActiveTab('chat');
        }}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        onNavigateTab={(tab) => {
          // Strictly prevent companions/advisors from navigating to knowledge base
          if (tab === 'knowledge' && !isUserAdmin) {
            setActiveTab('chat');
            return;
          }
          setActiveTab(tab);
        }}
        knowledgeCount={knowledgeItems.length}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Panel */}
      <main className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden relative">
        {activeTab === 'chat' || !isUserAdmin ? (
          <ChatView
            messages={currentMessages}
            knowledgeItems={knowledgeItems}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onNewConversation={handleNewConversation}
            onGoToKnowledgeBase={() => {
              if (isUserAdmin) {
                setActiveTab('knowledge');
              }
            }}
            onLoadSampleData={() => seedInitialKnowledgeIfEmpty(user.email)}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            isAdmin={isUserAdmin}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        ) : (
          <KnowledgeBaseView
            items={knowledgeItems}
            userEmail={user.email}
            onUploadFile={handleUploadFile}
            onEditItem={handleEditItem}
            onSaveLink={handleSaveLink}
            onDeleteItem={handleDeleteItem}
            onClearAllKnowledge={handleClearAllKnowledge}
            onUpdateContent={handleUpdateItemContent}
            unansweredQuestions={unansweredQuestions}
            onDeleteUnansweredQuestion={deleteUnansweredQuestion}
            onBackToChat={() => setActiveTab('chat')}
            isDarkMode={isDarkMode}
          />
        )}
      </main>
    </div>
  );
}
