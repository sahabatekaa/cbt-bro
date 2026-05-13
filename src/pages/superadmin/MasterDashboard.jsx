// src/pages/superadmin/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'; // Tambahkan signOut
import { useNavigate } from 'react-router-dom'; // Tambahkan useNavigate
import { Building2, CreditCard, Users, LogOut, Plus, Trash2, Database, Menu, X, Landmark, KeyRound, Activity, User, Phone, MessageCircle } from 'lucide-react';

export default function MasterDashboard({ onLogout }) {
  const navigate = useNavigate(); // Inisialisasi useNavigate
  const [activeTab, setActiveTab] = useState('clients');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientAdmins, setClientAdmins] = useState([]);
  
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ id: '', name: '', plan: 'Basic', expiryDate: '', picName: '', waNumber: '' });

  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', name: '', schoolId: '' });

  useEffect(() => {
    const clientsRef = ref(db, 'clients');
    const unsubClients = onValue(clientsRef, (snap) => {
      if (snap.exists()) {
        setClients(Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })));
      } else {
        setClients([]);
      }
    });

    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snap) => {
      if (snap.exists()) {
        const allUsers = Object.keys(snap.val()).map(key => ({ uid: key, ...snap.val()[key] }));
        setClientAdmins(allUsers.filter(u => u.role === 'admin_sekolah'));
      } else {
        setClientAdmins([]);
      }
    });

    return () => { unsubClients(); unsubUsers(); };
  }, []);

  // --- FUNGSI LOGOUT INTERNAL ---
  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth).then(() => {
      localStorage.clear();
      navigate('/login');
    }).catch((error) => {
      alert("Gagal keluar: " + error.message);
    });
  };

  // --- MANAJEMEN KLIEN (SEKOLAH) ---
  const handleSaveClient = (e) => {
    e.preventDefault();
    const clientId = clientForm.id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    set(ref(db, `clients/${clientId}`), {
      name: clientForm.name,
      plan: clientForm.plan,
      expiryDate: clientForm.expiryDate,
      picName: clientForm.picName,
      waNumber: clientForm.waNumber,
      status: 'active',
      createdAt: Date.now()
    }).then(() => {
      alert("Klien sekolah berhasil didaftarkan!");
      setShowAddClientModal(false);
      setClientForm({ id: '', name: '', plan: 'Basic', expiryDate: '', picName: '', waNumber: '' });
    }).catch(err => alert("Gagal: " + err.message));
  };

  const toggleClientStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if(window.confirm(`Yakin ingin ubah status klien ini menjadi ${newStatus.toUpperCase()}?`)) {
      update(ref(db, `clients/${id}`), { status: newStatus });
    }
  };

  const deleteClient = (id) => {
    if(window.confirm("PERINGATAN! Hapus klien ini secara permanen? Data tenant mereka akan kehilangan referensi billing.")) {
      remove(ref(db, `clients/${id}`));
    }
  };

  // --- MANAJEMEN AKUN ADMIN SEKOLAH ---
  const handleCreateClientAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.schoolId) return alert("Pilih sekolah untuk admin ini!");
    
    try {
      const auth = getAuth();
      const userCred = await createUserWithEmailAndPassword(auth, adminForm.email, adminForm.password);
      
      await set(ref(db, `users/${userCred.user.uid}`), {
        name: adminForm.name,
        email: adminForm.email,
        role: 'admin_sekolah',
        schoolId: adminForm.schoolId,
        status: 'active',
        createdAt: Date.now()
      });

      alert("Akun Admin Sekolah berhasil dibuat!");
      setShowAddAdminModal(false);
      setAdminForm({ email: '', password: '', name: '', schoolId: '' });
    } catch (err) {
      alert("Gagal membuat admin: " + err.message);
    }
  };

  const deleteAdmin = (uid) => {
    if(window.confirm("Hapus akses admin sekolah ini?")) remove(ref(db, `users/${uid}`));
  };

  const generateWALink = (phone) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    return `https://wa.me/${cleanPhone}`;
  };

  const NavItem = ({ tab, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${activeTab === tab ? 'bg-amber-500 text-black font-black shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white font-bold'}`}>
      <Icon size={18}/> <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans text-slate-200">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-black border-r border-slate-800 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl`}>
        <div className="p-5 border-b border-slate-800 flex justify-between items-center"><h1 className="text-xl font-black text-white flex gap-2 items-center tracking-widest"><Building2 className="text-amber-500" size={24}/> SAAS ROOT</h1><button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button></div>
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">FOUNDER / CS PANEL</p>
          <p className="text-xs font-bold truncate text-white uppercase">Sistem Billing & Klien</p>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <NavItem tab="clients" icon={Landmark} label="Database Sekolah" />
          <NavItem tab="admins" icon={Users} label="Akun Admin Klien" />
          <div className="my-3 border-t border-slate-800"></div>
          <NavItem tab="billing" icon={CreditCard} label="Tagihan & Paket" />
          <NavItem tab="database" icon={Database} label="System Log" />
        </nav>
        <div className="p-4 border-t border-slate-800">
            {/* INI TOMBOL KELUAR YANG SUDAH DIJAHIT */}
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-950 hover:bg-red-900 text-red-500 hover:text-white rounded-xl text-xs font-bold transition-colors">
                <LogOut size={16}/> Keluar
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0f1c]">
        <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-lg z-10">
           <div className="flex items-center gap-3">
             <button className="md:hidden text-amber-500" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
             <h2 className="text-lg font-black text-white tracking-widest uppercase">Master Control Center</h2>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* TAB KLIEN / SEKOLAH */}
          {activeTab === 'clients' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                 <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Landmark className="text-amber-500"/> Database Klien (Sekolah)</h3>
                    <p className="text-sm text-slate-500 mt-1">Kelola institusi yang berlangganan layanan CBT SaaS Anda.</p>
                 </div>
                 <button onClick={() => setShowAddClientModal(true)} className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 active:scale-95 transition-all"><Plus size={18}/> Tambah Sekolah Baru</button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {clients.map(client => (
                  <div key={client.id} className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-between gap-4 transition-all ${client.status === 'active' ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-red-900/50 opacity-75'}`}>
                     <div className="flex flex-col md:flex-row justify-between gap-4">
                       <div className="flex-1">
                         <div className="flex justify-between items-start mb-3">
                            <h4 className="text-lg font-black text-white tracking-tight leading-tight">{client.name}</h4>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${client.status === 'active' ? 'bg-emerald-950 text-emerald-500 border border-emerald-900/50' : 'bg-red-950 text-red-500 border border-red-900/50'}`}>
                               {client.status}
                            </span>
                         </div>
                         <div className="space-y-1.5 text-xs font-medium">
                            <p className="text-slate-400">ID Tenant: <span className="text-amber-500 font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{client.id}</span></p>
                            <p className="text-slate-400">Paket Sistem: <span className="text-blue-400">{client.plan}</span></p>
                            <p className="text-slate-400">Kadaluarsa: <span className="text-white">{client.expiryDate || 'Unlimited'}</span></p>
                         </div>
                       </div>
                       
                       <div className="md:border-l border-t md:border-t-0 border-slate-800 md:pl-4 pt-3 md:pt-0 w-full md:w-48 shrink-0 flex flex-col justify-between">
                          <div className="space-y-2 mb-3">
                            <div>
                               <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><User size={12}/> PIC Sekolah</p>
                               <p className="text-xs font-bold text-white truncate">{client.picName || '-'}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Phone size={12}/> WhatsApp</p>
                               <p className="text-xs font-bold text-white truncate">{client.waNumber || '-'}</p>
                            </div>
                          </div>
                          <a href={generateWALink(client.waNumber)} target="_blank" rel="noreferrer" className="w-full py-2 bg-emerald-950/40 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex justify-center items-center gap-1 border border-emerald-900/50">
                             <MessageCircle size={14}/> Follow Up WA
                          </a>
                       </div>
                     </div>

                     <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
                       <button onClick={() => toggleClientStatus(client.id, client.status)} className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors">
                          {client.status === 'active' ? 'Suspend Klien' : 'Aktifkan Klien'}
                       </button>
                       <button onClick={() => deleteClient(client.id)} className="py-2 bg-red-950/30 hover:bg-red-900 text-red-500 rounded-lg text-xs font-bold transition-colors">Hapus Permanen</button>
                     </div>
                  </div>
                ))}
                {clients.length === 0 && <div className="col-span-full p-10 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500">Belum ada sekolah yang didaftarkan.</div>}
              </div>
            </div>
          )}

          {/* TAB ADMIN KLIEN */}
          {activeTab === 'admins' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                 <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Users className="text-amber-500"/> Manajemen Akses Tata Usaha</h3>
                    <p className="text-sm text-slate-500 mt-1">Buatkan akun login khusus untuk operator/TU sekolah.</p>
                 </div>
                 <button onClick={() => setShowAddAdminModal(true)} className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 active:scale-95 transition-all"><KeyRound size={18}/> Buat Akun TU</button>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr><th className="p-4">Nama Admin TU</th><th className="p-4">Email Login</th><th className="p-4">Bertugas Di (ID Sekolah)</th><th className="p-4 text-center">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {clientAdmins.map(admin => (
                      <tr key={admin.uid} className="hover:bg-slate-800/30">
                        <td className="p-4 font-bold text-white">{admin.name}</td>
                        <td className="p-4 text-slate-400">{admin.email}</td>
                        <td className="p-4"><span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded font-mono text-xs font-bold">{admin.schoolId}</span></td>
                        <td className="p-4 text-center">
                          <button onClick={() => deleteAdmin(admin.uid)} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                    {clientAdmins.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Belum ada akun Admin Sekolah yang dibuat.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB PLACEHOLDER */}
          {(activeTab === 'billing' || activeTab === 'database') && (
            <div className="p-10 text-center border border-dashed border-slate-800 rounded-3xl mt-10">
               <Activity size={48} className="mx-auto text-slate-600 mb-4" />
               <h3 className="text-xl font-black text-slate-400">Modul Segera Hadir</h3>
               <p className="text-sm text-slate-500 mt-2">Area ini disiapkan untuk integrasi Payment Gateway & Log Database.</p>
            </div>
          )}

        </div>
      </main>

      {/* MODAL TAMBAH KLIEN */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-lg border border-slate-800 animate-in zoom-in-95 duration-200">
             <h2 className="text-xl font-black mb-4 text-white flex items-center gap-2"><Building2 className="text-amber-500"/> Registrasi Sekolah Baru</h2>
             <form onSubmit={handleSaveClient} className="space-y-4">
               <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">ID Tenant (Unik, Tanpa Spasi)</label><input required value={clientForm.id} onChange={e => setClientForm({...clientForm, id: e.target.value})} placeholder="cth: sdit-nurul-iman" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-amber-500 outline-none focus:border-amber-500" /></div>
               <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Nama Instansi Pendidikan</label><input required value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} placeholder="SDIT Nurul Iman" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-amber-500" /></div>
               
               <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                 <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest flex items-center gap-1"><User size={12}/> Nama PIC</label>
                   <input required value={clientForm.picName} onChange={e => setClientForm({...clientForm, picName: e.target.value})} placeholder="Bpk. Budi" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none focus:border-emerald-500" />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest flex items-center gap-1"><Phone size={12}/> No WhatsApp</label>
                   <input required value={clientForm.waNumber} onChange={e => setClientForm({...clientForm, waNumber: e.target.value})} placeholder="08123456789" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none focus:border-emerald-500" />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Paket Layanan</label><select value={clientForm.plan} onChange={e => setClientForm({...clientForm, plan: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-amber-500 cursor-pointer"><option>Basic</option><option>Premium</option><option>Enterprise</option></select></div>
                 <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Tgl Kadaluarsa</label><input type="date" required value={clientForm.expiryDate} onChange={e => setClientForm({...clientForm, expiryDate: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-slate-300 outline-none focus:border-amber-500" /></div>
               </div>
               
               <div className="flex gap-2 pt-4 border-t border-slate-800"><button type="button" onClick={() => setShowAddClientModal(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold active:scale-95 transition-all">Batal</button><button type="submit" className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-sm font-black active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all">Buat Klien</button></div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH ADMIN KLIEN */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-md border border-slate-800 animate-in zoom-in-95 duration-200">
             <h2 className="text-xl font-black mb-1 text-white flex items-center gap-2"><KeyRound className="text-amber-500"/> Buat Akun TU/Admin</h2>
             <p className="text-xs text-slate-400 mb-5">Akun ini akan mengelola guru di sekolah yang dipilih.</p>
             <form onSubmit={handleCreateClientAdmin} className="space-y-4">
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Tugaskan di Sekolah</label>
                  <select required value={adminForm.schoolId} onChange={e => setAdminForm({...adminForm, schoolId: e.target.value})} className="w-full p-3 bg-slate-950 border border-amber-500/50 rounded-xl text-sm font-black text-amber-500 outline-none focus:border-amber-500">
                     <option value="">-- Pilih Sekolah --</option>
                     {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                  </select>
               </div>
               <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Nama Lengkap</label><input required value={adminForm.name} onChange={e => setAdminForm({...adminForm, name: e.target.value})} placeholder="Operator SDIT" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-amber-500" /></div>
               <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Email Login</label><input type="email" required value={adminForm.email} onChange={e => setAdminForm({...adminForm, email: e.target.value})} placeholder="admin@sdit.com" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-amber-500" /></div>
                 <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Password</label><input type="password" required value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} placeholder="min. 6 karakter" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-amber-500" /></div>
               </div>
               <div className="flex gap-2 pt-4 border-t border-slate-800"><button type="button" onClick={() => setShowAddAdminModal(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold">Batal</button><button type="submit" className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-sm font-black">Buat Akun</button></div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}