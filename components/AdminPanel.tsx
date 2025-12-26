
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { UserRecord, ProcessLog } from '../types';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegOpen, setIsRegOpen] = useState(true);

  useEffect(() => {
    // جلب حالة التسجيل
    const unsubReg = onSnapshot(doc(db, "settings", "registration"), (docSnap) => {
      if (docSnap.exists()) {
        setIsRegOpen(docSnap.data().isOpen !== false);
      }
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserRecord[];
      setUsers(usersData);
    }, (err) => console.error("Users sync error:", err));

    const logsQuery = query(collection(db, "process_logs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProcessLog[];
      setLogs(logsData);
      setIsLoading(false);
    }, (err) => {
      console.error("Logs sync error:", err);
      setIsLoading(false);
    });

    return () => {
      unsubReg();
      unsubUsers();
      unsubLogs();
    };
  }, []);

  const toggleRegistration = async () => {
    try {
      const regRef = doc(db, "settings", "registration");
      await setDoc(regRef, { isOpen: !isRegOpen }, { merge: true });
    } catch (e) {
      alert("خطأ في تحديث إعدادات التسجيل");
    }
  };

  const updateUserStatus = async (userId: string, updates: Partial<UserRecord>) => {
    try {
      await updateDoc(doc(db, "users", userId), updates);
    } catch (e) {
      alert("خطأ في التحديث");
    }
  };

  const deleteUser = async (userId: string) => {
    if (confirm("حذف المستخدم نهائياً؟")) {
      try {
        await deleteDoc(doc(db, "users", userId));
      } catch (e) {
        alert("فشل الحذف");
      }
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return "...";
    try {
      if (typeof ts.toDate === 'function') {
        return ts.toDate().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
      }
      return new Date(ts).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return "N/A";
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700 font-sans pb-10">
      <div className="flex flex-col items-center justify-between gap-6 mb-8">
        <div className="text-center sm:text-right w-full">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase mb-1">
            {activeTab === 'users' ? 'إدارة الأعضاء' : 'سجل النشاط'}
          </h2>
          <p className="text-slate-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em]">Master Control</p>
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5 w-full max-w-xs mx-auto">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-sky-500 text-white shadow-glow-sky-sm' : 'text-slate-500'}`}
          >
            المستخدمين
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-sky-500 text-white shadow-glow-sky-sm' : 'text-slate-500'}`}
          >
            السجلات
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="mb-6 p-4 sm:p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between gap-4">
           <div className="text-right">
              <h4 className="text-white text-xs sm:text-sm font-black mb-1">حالة تسجيل المستخدمين</h4>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                {isRegOpen ? 'التسجيل متاح حالياً للجميع' : 'التسجيل مغلق الآن بقرارك'}
              </p>
           </div>
           <button 
             onClick={toggleRegistration}
             className={`px-4 sm:px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border ${
               isRegOpen 
                ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' 
                : 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 shadow-glow-green-sm'
             }`}
           >
             {isRegOpen ? 'إغلاق التسجيل' : 'فتح التسجيل'}
           </button>
        </div>
      )}

      <div className="bg-slate-950/50 rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl relative">
        {activeTab === 'users' ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse min-w-[320px]">
              <thead>
                <tr className="bg-white/[0.03] text-slate-400 text-[8px] font-black uppercase tracking-widest border-b border-white/5">
                  <th className="px-4 sm:px-8 py-4 sm:py-6">المستخدم</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-6 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 sm:px-8 py-4 sm:py-6">
                      <div className="flex items-center justify-end gap-3">
                        <div className="text-right">
                          <div className="text-white font-black text-xs sm:text-sm truncate max-w-[120px]">{user.name || 'مستخدم'}</div>
                          <div className={`text-[8px] font-black uppercase tracking-widest ${user.status === 'active' ? 'text-green-500' : user.status === 'pending' ? 'text-sky-400' : 'text-red-500'}`}>
                            {user.status === 'pending' ? 'بانتظار الموافقة' : user.status === 'active' ? 'نشط' : 'محظور'}
                          </div>
                        </div>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-base bg-slate-800 text-sky-400 border border-white/5 shadow-inner">
                          {(user.name?.[0] || 'U').toUpperCase()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-6">
                      <div className="flex items-center justify-center gap-2">
                         {user.status === 'pending' && (
                           <button onClick={() => updateUserStatus(user.id, { isApproved: true, status: 'active' })} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[8px] font-black uppercase shadow-glow-green-sm">موافقة</button>
                         )}
                         {user.status === 'active' && user.role !== 'admin' && (
                           <button onClick={() => updateUserStatus(user.id, { isApproved: false, status: 'banned' })} className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[8px] font-black uppercase">حظر</button>
                         )}
                         {user.status === 'banned' && (
                           <button onClick={() => updateUserStatus(user.id, { isApproved: true, status: 'active' })} className="px-3 py-1.5 bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-lg text-[8px] font-black uppercase">إلغاء الحظر</button>
                         )}
                         <button onClick={() => deleteUser(user.id)} className="p-2 bg-white/5 text-slate-500 hover:text-red-500 rounded-lg transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse min-w-[320px]">
              <thead>
                <tr className="bg-white/[0.03] text-slate-400 text-[8px] font-black uppercase tracking-widest border-b border-white/5">
                  <th className="px-4 sm:px-8 py-4 sm:py-6">الملف</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-6 text-center">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.length === 0 ? (
                  <tr><td colSpan={2} className="py-20 text-center text-slate-700 text-[8px] font-black uppercase tracking-[0.4em]">لا توجد سجلات حالياً</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 sm:px-8 py-4 sm:py-6">
                        <div className="text-right">
                          <div className="text-white font-bold text-xs truncate max-w-[150px]">{log.fileName || 'ملف'}</div>
                          <div className="text-slate-600 text-[8px] font-black uppercase tracking-widest opacity-60">{log.userName}</div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-6 text-center">
                        <div className="text-slate-500 text-[8px] font-mono bg-white/5 px-3 py-1 rounded-lg inline-block">{formatTimestamp(log.timestamp)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`
        .shadow-glow-sky-sm { box-shadow: 0 0 15px rgba(14, 165, 233, 0.2); }
        .shadow-glow-green-sm { box-shadow: 0 0 15px rgba(34, 197, 94, 0.2); }
      `}</style>
    </div>
  );
};
