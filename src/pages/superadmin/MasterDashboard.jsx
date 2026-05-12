// src/pages/superadmin/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { Crown, Activity, Building2, CreditCard, LogOut, Menu, X, Plus, Zap, ShieldAlert, CheckCircle, Trash2, Edit, Server, Globe } from 'lucide-react';

const APP_VERSION = "3.0.0 SaaS";

export default function MasterDashboard() {
  const { currentUser, userData } = useAuth();
  const [activeTab, setActiveTab] = useState('radar');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // State Multi-Tenant (Klien Sekolah)
  const [tenants, setTenants] = useState([]);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [tenantForm, setTenantForm] = useState({ id: '', name: '', plan: 'Pro', status: 'active' });

  // Tarik Data Tenant dari Master Control
  useEffect(() => {
    const tenantsRef = ref(db, 'master_control/tenants');
    const unsubscribe = onValue(tenantsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setTenants(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setTenants([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const stats = {
    totalTenants: tenants.length,
    activeTenants: tenants.filter(t => t.status === 'active').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
  };

  // ==========================================
  // FUNGSI KENDALI SAAS (MASTER)
  // ==========================================
  const handleAddTenant = async (e) => {
    e.preventDefault();
    const cleanId = tenantForm.id.toLowerCase().replace(/[^a-z0-9-]/g, ''); // Format ID jadi darma-pertiwi
    
    if (tenants.find(t => t.id === cleanId)) {
      return alert("ID Sekolah ini sudah terdaftar di sistem!");
    }

    try {
      // 1. Daftarkan di Master Control
      await set(ref(db, `master_control/tenants/${cleanId}`), {
        name: tenantForm.name,
        plan: tenantForm.plan,
        status: tenantForm.status,
        createdAt: Date.now()
      });

      // 2. Buatkan "Kamar" Profil Khusus Tenant
      await set(ref(db, `tenants/${cleanId}/profile`), {
        schoolName: tenantForm.name,
        registeredAt: Date.now(),
        subscription: tenantForm.plan
      });

      alert(`✅ Klien Yayasan "${tenantForm.name}" berhasil ditambahkan ke Server!`);
      setShowAddTenant(false);
      setTenantForm({ id: '', name: '', plan: 'Pro', status: 'active' });
    } catch (err) {
      alert("Gagal menambahkan Tenant: " + err.message);
    }
  };

  const toggleTenantStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const msg = newStatus === 'suspended' 
      ? `KUNCI PAKSA akses untuk yayasan ini? Seluruh guru dan siswa tidak akan bisa login.`
      : `BUKA KEMBALI akses untuk yayasan ini?`;
      
    if (window.confirm(msg)) {
      update(ref(db, `master_control/tenants/${id}`), { status: newStatus });
    }
  };

  const deleteTenant = (id) => {
    const konfirmasi = window.prompt(`🚨 HANCURKAN DATA YAYASAN!\nIni akan menghapus profil yayasan dari radar master.\n\nKetik 'HAPUS' untuk melanjutkan:`);
    if (konfirmasi === 'HAPUS') {
      remove(ref(db, `master_control/tenants/${id}`));
      // Catatan CTO: Di sistem riil, pastikan juga menghapus folder tenants/{id} jika ingin bersih total
      alert("Yayasan berhasil dihapus dari sistem Master.");
    }
  };

  const triggerGlobalUpdate = () => {
    if(window.confirm(`🚀 RILIS UPDATE GLOBAL V3\nApakah Anda yakin ingin menyalakan saklar Global Sync?\nIni akan memaksa SELURUH perangkat klien memuat ulang sistem.`)) {
      set(ref(db, 'master_control/global_settings/activeVersion'), APP_VERSION)
        .then(() => alert("⚡ BUM! Sinyal Update Global Terkirim!"))
        .catch(err => alert("Gagal mengirim sinyal."));
    }
  };

  // Komponen Sidebar
  const NavItem = ({ tab, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === tab ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white font-bold'}`}>
      <Icon size={18}/> <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-200 overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      {/* SIDEBAR MASTER ADMIN */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-black border-r border-slate-800 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h1 className="text-xl font-black text-white flex gap-2 items-center tracking-widest">
            <Crown className="text-amber-500" size={24}/> SAAS MASTER
          </h1>
          <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button>
        </div>
        <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-black">
          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">ENGINE {APP_VERSION}</p>
          <p className="text-xs font-bold text-white uppercase truncate">{userData?.name || 'Super Admin Pusat'}</p>
        </div>
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto mt-2">
          <NavItem tab="radar" icon={Activity} label="Radar Server" />
          <NavItem tab="tenants" icon={Building2} label="Manajemen Klien (Tenant)" />
          <NavItem tab="billing" icon={CreditCard} label="Tagihan & Langganan" />
        </nav>
        <div className="p-3 border-t border-slate-800">
           <button onClick={triggerGlobalUpdate} className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black text-xs shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95 uppercase tracking-tighter">
              <Zap size={16}/> RILIS UPDATE CLIENT
           </button>
        </div>
      </aside>

      {/* AREA UTAMA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0f1c]">
        {/* HEADER */}
        <header className="bg-slate-900 border-b border-slate-800 p-3 lg:p-4 flex justify-between items-center shadow-lg z-10">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 bg-slate-800 rounded-lg text-amber-500" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
            <div className="hidden md:flex items-center gap-3">
               <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20"><Globe size={20} className="text-amber-500" /></div>
               <div>
                  <h2 className="text-xs font-black text-white leading-tight tracking-widest uppercase">JARINGAN MULTI-TENANT AKTIF</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Semua data sekolah terisolasi aman</p>
               </div>
            </div>
            <h2 className="text-lg font-black text-white md:hidden tracking-wider">SAAS V3</h2>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sistem Online</span>
          </div>
        </header>

        {/* KONTEN HALAMAN */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          
          {/* TAB RADAR SAAS */}
          {activeTab === 'radar' && (
            <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-300">
              <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><Activity className="text-amber-500" size={20}/> Status Infrastruktur</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 border-b-4 border-b-amber-500 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-5"><Building2 size={80}/></div>
                  <p className="text-slate-400 font-bold text-xs mb-1 uppercase tracking-widest">Klien Terdaftar</p>
                  <p className="text-3xl font-black text-white">{stats.totalTenants}</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 border-b-4 border-b-emerald-500 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-5"><CheckCircle size={80}/></div>
                  <p className="text-slate-400 font-bold text-xs mb-1 uppercase tracking-widest">Klien Aktif</p>
                  <p className="text-3xl font-black text-emerald-400">{stats.activeTenants}</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 border-b-4 border-b-blue-500 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-5"><Server size={80}/></div>
                  <p className="text-slate-400 font-bold text-xs mb-1 uppercase tracking-widest">Beban Server Node</p>
                  <p className="text-3xl font-black text-blue-400">Normal</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB MANAJEMEN KLIEN (TENANTS) */}
          {activeTab === 'tenants' && (
            <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><Building2 className="text-amber-500" size={20}/> Daftar Klien Yayasan</h3>
                <button onClick={() => setShowAddTenant(true)} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(245,158,11,0.3)] active:scale-95 transition-all uppercase tracking-wide">
                  <Plus size={16}/> Tambah Sekolah
                </button>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto shadow-lg">
                <table className="w-full text-left text-sm min-w-[700px] whitespace-nowrap">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-4 px-6 font-bold uppercase tracking-wider text-xs">ID Tenant / Endpoint</th>
                      <th className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Nama Institusi</th>
                      <th className="py-4 px-6 font-bold uppercase tracking-wider text-xs text-center">Paket</th>
                      <th className="py-4 px-6 font-bold uppercase tracking-wider text-xs text-center">Status</th>
                      <th className="py-4 px-6 font-bold uppercase tracking-wider text-xs text-center">Kontrol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {tenants.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-amber-500 text-xs">{t.id}</td>
                        <td className="py-4 px-6 font-black text-white">{t.name}</td>
                        <td className="py-4 px-6 text-center">
                          <span className="bg-blue-950/50 text-blue-400 border border-blue-900/50 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{t.plan}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${t.status === 'active' ? 'bg-emerald-950/50 text-emerald-500 border-emerald-900/50' : 'bg-red-950/50 text-red-500 border-red-900/50'}`}>
                            {t.status === 'active' ? 'Aktif' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => toggleTenantStatus(t.id, t.status)} title="Buka/Tutup Akses" className={`p-2 rounded-lg transition-all active:scale-95 border ${t.status === 'active' ? 'text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-950/50 border-slate-700' : 'text-slate-400 hover:text-emerald-400 bg-slate-800 hover:bg-emerald-950/50 border-slate-700'}`}>
                              <ShieldAlert size={16}/>
                            </button>
                            <button onClick={() => deleteTenant(t.id)} title="Hapus Tenant" className="text-slate-400 hover:text-red-500 bg-slate-800/50 hover:bg-red-950/30 p-2 rounded-lg transition-all active:scale-95 border border-slate-700/50"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr><td colSpan="5" className="text-center p-8 text-slate-500 text-sm font-bold">Belum ada Klien Sekolah yang terdaftar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB BILLING (MOCKUP) */}
          {activeTab === 'billing' && (
            <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-300">
               <h3 className="text-xl font-black text-white flex items-center gap-2"><CreditCard className="text-amber-500" size={20}/> Pusat Tagihan Klien</h3>
               <div className="bg-slate-900 p-8 rounded-2xl border border-dashed border-slate-700 text-center">
                  <CreditCard className="mx-auto text-slate-600 mb-4" size={48} />
                  <h4 className="text-lg font-black text-white mb-2">Modul Billing Sedang Disiapkan</h4>
                  <p className="text-slate-400 text-sm">Integrasi Payment Gateway (Midtrans/Xendit) akan dipasang di fase pengembangan berikutnya.</p>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL TAMBAH TENANT BARU */}
      {showAddTenant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-black mb-1 text-white flex items-center gap-2"><Building2 className="text-amber-500" size={20}/> Daftarkan Klien Baru</h2>
            <p className="text-xs text-slate-400 mb-5">Sistem akan membuat ruang isolasi database khusus untuk sekolah ini.</p>
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">ID Endpoint (Tanpa Spasi)</label>
                 <input required value={tenantForm.id} placeholder="contoh: darma-pertiwi" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-amber-500 text-sm font-bold text-white shadow-inner font-mono" onChange={e => setTenantForm({...tenantForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Nama Yayasan / Sekolah</label>
                 <input required value={tenantForm.name} placeholder="Yaspendik Darma Pertiwi" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-amber-500 text-sm font-bold text-white shadow-inner" onChange={e => setTenantForm({...tenantForm, name: e.target.value})} />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Paket SaaS</label>
                 <select value={tenantForm.plan} onChange={e => setTenantForm({...tenantForm, plan: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-amber-500">
                    <option value="Starter">Starter (Basic)</option>
                    <option value="Pro">Pro (Recommended)</option>
                    <option value="Enterprise">Enterprise (Custom)</option>
                 </select>
              </div>
              <div className="flex gap-2 pt-3">
                 <button type="button" onClick={() => setShowAddTenant(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold active:scale-95 transition-colors">Batal</button>
                 <button type="submit" className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-sm font-black active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-colors">Buat Instansi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}