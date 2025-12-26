
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  limit,
  onSnapshot,
  doc
} from 'firebase/firestore';
import { UserRecord } from '../types';

const MASTER_ADMIN_EMAIL = "admin@genius.com";
const MASTER_ADMIN_PASSWORD = "admin123";

interface LoginProps {
  onLogin: (user: UserRecord) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isRegOpen, setIsRegOpen] = useState(true);

  // مراقبة حالة التسجيل من قاعدة البيانات
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "registration"), (docSnap) => {
      if (docSnap.exists()) {
        setIsRegOpen(docSnap.data().isOpen !== false);
      }
    });
    return () => unsub();
  }, []);

  const fetchAndCheckUser = async (userEmail: string) : Promise<UserRecord | null> => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", userEmail.toLowerCase()), limit(1));
    const querySnapshot = await getDocs(q);

    const isMaster = userEmail.toLowerCase() === MASTER_ADMIN_EMAIL;

    if (querySnapshot.empty) {
      const allUsersSnapshot = await getDocs(query(collection(db, "users"), limit(1)));
      const isFirstUser = allUsersSnapshot.empty || isMaster;

      const newUser = {
        name: isMaster ? "Master Admin" : (name || userEmail.split('@')[0]),
        email: userEmail.toLowerCase(),
        password: password || MASTER_ADMIN_PASSWORD, 
        role: isFirstUser ? 'admin' : 'user',
        isApproved: isFirstUser,
        status: isFirstUser ? 'active' : 'pending',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };
      
      const docRef = await addDoc(usersRef, newUser);
      return { id: docRef.id, ...newUser } as UserRecord;
    } else {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as UserRecord;
      
      if (isMaster && userData.role !== 'admin') {
         await updateDoc(userDoc.ref, { role: 'admin', isApproved: true, status: 'active' });
         userData.role = 'admin';
         userData.isApproved = true;
         userData.status = 'active';
      }

      await updateDoc(userDoc.ref, { lastLogin: serverTimestamp() });
      return { id: userDoc.id, ...userData };
    }
  };

  const handleAuthResult = (user: UserRecord, fromSignup: boolean = false) => {
    if (user.status === 'banned') {
      setError("عذراً، هذا الحساب محظور من قبل الإدارة.");
      return;
    }
    
    if (!user.isApproved && user.role !== 'admin') {
      if (fromSignup) {
        setSuccessMessage("تم إرسال طلب الانضمام بنجاح! حسابك بانتظار موافقة المسؤول حالياً.");
        setIsSignUp(false); 
      } else {
        setError("عذراً، حسابك بانتظار موافقة المسؤول. يرجى مراجعة الإدارة.");
      }
      return;
    }
    
    onLogin(user);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (email.toLowerCase() === MASTER_ADMIN_EMAIL && password === MASTER_ADMIN_PASSWORD) {
         const user = await fetchAndCheckUser(email);
         if (user) {
           handleAuthResult(user);
           return;
         }
      }

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.toLowerCase()), limit(1));
      const querySnapshot = await getDocs(q);

      if (isSignUp) {
        if (!isRegOpen) {
          setError("عذراً، التسجيل مغلق حالياً بقرار من الإدارة.");
          setIsLoading(false);
          return;
        }
        if (!querySnapshot.empty) {
          setError("هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.");
          setIsSignUp(false);
          setIsLoading(false);
          return;
        }
        const user = await fetchAndCheckUser(email);
        if (user) handleAuthResult(user, true);
      } else {
        if (querySnapshot.empty) {
          setError("عذراً، هذا البريد غير مسجل. يمكنك إنشاء حساب جديد.");
        } else {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data() as UserRecord;
          if (userData.password !== password) {
            setError("كلمة المرور غير صحيحة.");
          } else {
            handleAuthResult({ id: userDoc.id, ...userData });
          }
        }
      }
    } catch (err) {
      setError("حدث خطأ في النظام، يرجى المحاولة لاحقاً.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-900/60 backdrop-blur-3xl border-l border-white/10 flex flex-col p-6 sm:p-14 relative overflow-y-auto font-arabic">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-indigo-600 shadow-glow-sky"></div>
      
      <div className="lg:hidden flex items-center justify-center gap-4 mb-10 pt-4">
          <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-2xl italic">S</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter">SVGA <span className="text-sky-400">GENIUS</span></h1>
      </div>

      <div className="flex-1 flex flex-col justify-center text-right max-w-md mx-auto w-full">
        <div className="mb-8 sm:mb-12">
          {!isRegOpen && isSignUp && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 text-[10px] font-black text-center animate-pulse">
              ⚠️ تنبيه: التسجيل متوقف حالياً
            </div>
          )}
          <div className="inline-block px-4 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full text-sky-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-4">
            SVGA Genius v2.9 • Secured Access
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tighter">
            {isSignUp ? 'طلب انضمام' : 'دخول المصممين'}
          </h2>
          <p className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-widest leading-relaxed">
            {isSignUp ? 'املأ البيانات لتقديم طلب دخول' : 'أدخل بياناتك للمتابعة'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] sm:text-[11px] font-bold text-center animate-shake leading-loose">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-5 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-[10px] sm:text-[11px] font-bold text-center leading-loose">
            <svg className="w-5 h-5 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {isSignUp && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block">الاسم بالكامل</label>
              <input 
                type="text" required disabled={isLoading || (!isRegOpen && isSignUp)} value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 sm:py-4 px-5 sm:px-6 text-white text-sm focus:border-sky-500/30 outline-none transition-all text-right shadow-inner disabled:opacity-50"
                placeholder="أدخل اسمك"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block">البريد الإلكتروني</label>
            <input 
              type="email" required disabled={isLoading || (!isRegOpen && isSignUp)} value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 sm:py-4 px-5 sm:px-6 text-white text-sm outline-none focus:border-sky-500/30 transition-all text-left shadow-inner font-sans disabled:opacity-50"
              placeholder="example@mail.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block">كلمة المرور</label>
            <input 
              type="password" required disabled={isLoading || (!isRegOpen && isSignUp)} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 sm:py-4 px-5 sm:px-6 text-white text-sm outline-none focus:border-sky-500/30 transition-all text-left shadow-inner font-sans disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" disabled={isLoading || (!isRegOpen && isSignUp)}
            className={`w-full py-4 sm:py-5 text-white font-black rounded-2xl transition-all shadow-glow-sky-sm hover:shadow-glow-sky text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-3 ${(!isRegOpen && isSignUp) ? 'bg-slate-800 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-indigo-600 active:scale-95'}`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (isSignUp ? 'إرسال طلب انضمام' : 'دخول المنصة')}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/5 text-center flex flex-col gap-6">
          <button 
              type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMessage(null); }}
              className="text-sky-400 hover:text-white text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
          >
              {isSignUp ? (
                <>لديك حساب؟ <span className="underline">سجل دخولك</span></>
              ) : (
                <>ليس لديك حساب؟ <span className="underline">اطلب انضمام</span></>
              )}
          </button>
        </div>
      </div>

      <div className="mt-auto text-center pb-4">
        <p className="text-[8px] text-slate-700 font-black uppercase tracking-[0.5em]">Quantum Security Active</p>
      </div>
      
      <style>{`
        .shadow-glow-sky { box-shadow: 0 0 30px rgba(14, 165, 233, 0.4); }
        .shadow-glow-sky-sm { box-shadow: 0 0 15px rgba(14, 165, 233, 0.2); }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};
