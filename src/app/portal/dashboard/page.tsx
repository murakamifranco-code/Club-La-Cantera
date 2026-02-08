'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { 
  LayoutDashboard, User, LogOut, Menu, Loader2, Edit2, Save, Upload, 
  CheckCircle, Clock, ArrowUpRight, ArrowDownLeft, X, Eye, ExternalLink, Settings,
  ShieldCheck, Lock, Shield, Mail, Phone, MapPin, Calendar, CreditCard
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function PortalDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('dashboard') 
  const [sidebarOpen, setSidebarOpen] = useState(false) // Cerrado por defecto en móvil
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<'image' | 'pdf'>('image') 

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  useEffect(() => { fetchUserData() }, [])

  // Detectar ancho de pantalla para cerrar sidebar en móvil automáticamente
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true)
      else setSidebarOpen(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Función para formatear CUIL automáticamente al editar
  const formatCuil = (val: string) => {
    let value = val.replace(/\D/g, ""); // Solo números
    if (value.length > 11) value = value.slice(0, 11);
    let formatted = value;
    if (value.length > 2) formatted = `${value.slice(0, 2)}-${value.slice(2)}`;
    if (value.length > 10) formatted = `${formatted.slice(0, 11)}-${value.slice(10, 11)}`;
    return formatted;
  }

  const handleCuilChange = (val: string) => {
    setFormData({ ...formData, cuil: formatCuil(val) });
  }

  const handlePayerCuilChange = (val: string) => {
    setFormData({ ...formData, payer_cuil: formatCuil(val) });
  }

  const fetchUserData = async () => {
    try {
      const storedId = localStorage.getItem('club_player_id')
      if (!storedId) throw new Error('No hay sesión')
      const { data: userData } = await supabase.from('users').select('*').eq('id', storedId).single()
      if (userData) { 
        setUser(userData); 
        // Normalización de género para que no aparezca vacío el select
        const dbGender = (userData.gender || "").toLowerCase();
        let normalizedGender = "";
        if (dbGender === 'masculino' || dbGender === 'male' || dbGender === 'm') normalizedGender = "Masculino";
        else if (dbGender === 'femenino' || dbGender === 'female' || dbGender === 'f') normalizedGender = "Femenino";
        else if (dbGender === 'otro' || dbGender === 'other' || dbGender === 'x') normalizedGender = "Otro";
        
        setFormData({ ...userData, gender: normalizedGender }); 
      }
      const { data: paymentsData } = await supabase.from('payments').select('*').eq('user_id', storedId).order('date', { ascending: false })
      setPayments(paymentsData || [])
    } catch (error) { router.replace('/portal') } finally { setLoading(false) }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); router.replace('/portal') }

  const handleSaveProfile = async () => {
    setSaveLoading(true)
    setMessage(null)
    try {
      const updates = {
        name: formData.name, 
        cuil: formData.cuil, 
        email: formData.email, 
        phone: formData.phone, 
        address: formData.address,
        gender: formData.gender, 
        birth_date: formData.birth_date && formData.birth_date !== "" ? formData.birth_date : null,
        emergency_contact: formData.emergency_contact, 
        emergency_phone: formData.emergency_phone,
        medical_conditions: formData.medical_conditions,
        payer_name: formData.payer_name, // Nuevo campo
        payer_cuil: formData.payer_cuil, // Nuevo campo
        updated_at: new Date().toISOString()
      }
      const { error } = await supabase.from('users').update(updates).eq('id', user.id)
      if (error) throw error
      setUser({ ...user, ...updates }); setIsEditing(false); setMessage({ type: 'success', text: '¡Datos actualizados con éxito!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) { setMessage({ type: 'error', text: 'Error al guardar.' }) } finally { setSaveLoading(false) }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); if (!amount) return; setUploading(true)
      try {
          let publicUrl = null
          if (file) {
              const fileName = `${user.id}/${Date.now()}.${file.name.split('.').pop()}`
              const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file)
              if (uploadError) throw uploadError
              publicUrl = supabase.storage.from('receipts').getPublicUrl(fileName).data.publicUrl
          }
          
          // ARREGLO PARA QUE EL PAGO SE MUESTRE: Se quitan payer_name y payer_cuil para evitar error de columna inexistente
          const { error: insertError } = await supabase.from('payments').insert({
              user_id: user.id, 
              amount: parseFloat(amount), 
              method: 'transfer', 
              status: 'pending', 
              date: new Date().toISOString(), 
              proof_url: publicUrl
          })

          if (insertError) throw insertError

          setUploadSuccess(true); setAmount(''); setFile(null)
          setTimeout(() => { setUploadSuccess(false); setActiveTab('dashboard'); fetchUserData() }, 2000)
      } catch (error: any) { 
          alert("Error al enviar el comprobante: " + error.message) 
      } finally { setUploading(false) }
  }

  const handleOpenPreview = (url: string) => { setFileType(url.toLowerCase().includes('.pdf') ? 'pdf' : 'image'); setPreviewUrl(url) }

  const visualBalance = user?.account_balance || 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#1e1b4b]"><Loader2 className="animate-spin text-white" size={40}/></div>

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans relative text-left">
      {/* SIDEBAR RESPONSIVO */}
      <aside className={`bg-[#1e1b4b] text-white transition-all duration-300 ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'} fixed h-full z-30 flex flex-col shadow-xl overflow-hidden`}>
        <div className="p-6 flex items-center justify-between border-b border-white/10 min-w-[256px] lg:min-w-0 text-left">
          {sidebarOpen ? <div className="flex items-center gap-3 text-left"><div className="bg-white p-1 rounded-full"><img src="/logo.png" className="h-6 w-6 object-contain" /></div><div><h1 className="font-black italic leading-none text-sm uppercase">CLUB LA CANTERA</h1></div></div> : <img src="/logo.png" className="h-8 w-8 mx-auto bg-white rounded-full p-1" />}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white lg:hidden"><X size={20} /></button>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-6 min-w-[256px] lg:min-w-0 text-left">
          <button onClick={() => { setActiveTab('dashboard'); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-[#4f46e5] text-white font-bold shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}><LayoutDashboard size={20} /> {sidebarOpen && <span>Dashboard</span>}</button>
          <button onClick={() => { setActiveTab('profile'); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'profile' ? 'bg-[#4f46e5] text-white font-bold shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}><User size={20} /> {sidebarOpen && <span>Mi Perfil</span>}</button>
          <button onClick={() => { setActiveTab('payment'); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'payment' ? 'bg-[#4f46e5] text-white font-bold shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}><Upload size={20} /> {sidebarOpen && <span>Informar Pago</span>}</button>
        </nav>
        <div className="p-4 border-t border-white/10 min-w-[256px] lg:min-w-0 text-left"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-bold transition text-left"><LogOut size={20} /> {sidebarOpen && <span>Salir</span>}</button></div>
      </aside>

      {/* OVERLAY PARA MÓVIL CUANDO SIDEBAR ESTÁ ABIERTO */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} p-4 md:p-8 text-left`}>
        {/* BOTÓN MENÚ MÓVIL */}
        <div className="lg:hidden mb-4 flex items-center gap-3 text-left">
          <button onClick={() => setSidebarOpen(true)} className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-[#1e1b4b]"><Menu size={24}/></button>
          <h1 className="font-black italic text-sm text-[#1e1b4b] uppercase">LA CANTERA</h1>
        </div>

        {activeTab === 'dashboard' && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 text-left">
             <div className="mb-6 text-left"><h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase">HOLA, {user.name?.split(' ')[0]}</h2><p className="text-gray-500 text-sm">Bienvenido a tu panel personal.</p></div>
             
             <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-8 mb-8 relative overflow-hidden text-left">
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${visualBalance < 0 ? 'bg-red-500' : (visualBalance === 0 ? 'bg-gray-300' : 'bg-green-500')}`}></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                    <div className="text-left">
                        <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest mb-2 text-left">ESTADO DE CUENTA (CONFIRMADO)</p>
                        <h3 className={`text-2xl md:text-4xl font-black break-words text-left ${visualBalance < 0 ? 'text-red-600' : (visualBalance === 0 ? 'text-gray-400' : 'text-green-600')}`}>
                            {visualBalance < 0 ? 'Debe: ' : (visualBalance === 0 ? 'Saldo: ' : 'A favor: ')} 
                            ${Math.abs(visualBalance).toLocaleString()}
                        </h3>
                    </div>
                    <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto"><p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase text-left">TU CATEGORÍA</p><p className="text-lg md:text-xl font-black text-gray-800 text-left">{user.category}</p></div>
                </div>
             </div>

             <div className="w-full max-w-5xl text-left">
                <h3 className="text-sm font-black text-gray-500 uppercase mb-3 flex items-center gap-2 text-left"><Clock size={16}/> Historial de Movimientos</h3>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-left">
                    {payments.length > 0 ? (
                        <div className="divide-y divide-gray-100 text-left">
                            {payments.map((p) => {
                                const isAdjustment = p.method === 'adjustment' 
                                const isDebit = p.amount < 0
                                const isPending = p.status === 'pending'
                                const hasProof = p.method === 'transfer' && p.proof_url
                                return (
                                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition gap-3 text-left">
                                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden text-left">
                                            <div className={`h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center shrink-0 ${isAdjustment ? 'bg-blue-100 text-blue-600' : (isDebit ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600')}`}>
                                                {isAdjustment ? <Settings size={16}/> : (isDebit ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>)}
                                            </div>
                                            <div className="truncate text-left">
                                                <p className="font-bold text-xs md:text-sm text-gray-800 truncate text-left">
                                                    {isAdjustment ? 'Ajuste Administrativo' : (p.method === 'transfer' ? 'Transferencia' : (p.method === 'cuota' ? 'Cuota Mensual' : 'Pago'))}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5 text-left">
                                                    <p className="text-[10px] text-gray-500 font-medium text-left">{format(parseISO(p.date), 'dd/MM/yy', { locale: es })}</p>
                                                    {isPending && <span className="text-orange-500 text-[9px] font-bold uppercase tracking-wider text-left">Pendiente</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 md:gap-6 shrink-0 text-left">
                                            <p className={`text-sm md:text-base font-black text-left ${isPending ? 'text-orange-500' : (isAdjustment ? 'text-blue-600' : (isDebit ? 'text-red-500' : 'text-green-500'))}`}>
                                                {isDebit ? '-' : '+'}${Math.abs(p.amount).toLocaleString()}
                                            </p>
                                            {hasProof && (
                                                <button onClick={() => handleOpenPreview(p.proof_url)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition"><Eye size={18}/></button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : ( <div className="p-8 text-center text-gray-400 text-[10px] uppercase font-bold">Sin movimientos registrados</div> )}
                </div>
             </div>
          </div>
        )}

        {previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 md:p-4 backdrop-blur-sm text-left" onClick={() => setPreviewUrl(null)}>
              <div className={`relative bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] w-full text-left ${fileType === 'pdf' ? 'max-w-4xl h-[80vh]' : 'max-w-5xl h-auto'}`} onClick={e => e.stopPropagation()}>
                  <div className="p-3 bg-gray-50 border-b flex justify-between items-center shrink-0 text-left">
                       <div className="flex items-center gap-3 text-left"><h3 className="font-bold text-gray-800 text-[10px] md:text-sm uppercase">Comprobante</h3><a href={previewUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-[9px] md:text-xs font-bold bg-indigo-50 px-2 py-1 rounded"><ExternalLink size={12}/> Abrir original</a></div>
                      <button onClick={() => setPreviewUrl(null)} className="p-1.5 text-gray-600 hover:bg-gray-300 rounded-full transition"><X size={20}/></button>
                  </div>
                  <div className="flex-1 bg-gray-200 relative flex items-center justify-center p-2 overflow-auto text-left">
                      {fileType === 'image' ? <img src={previewUrl} className="max-w-full max-h-[85vh] object-contain rounded shadow-sm bg-white" /> : <iframe src={previewUrl} className="w-full h-full border-0 rounded bg-white shadow-sm" />}
                  </div>
              </div>
          </div>
        )}

        {activeTab === 'profile' && (
           <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 pb-10 text-left">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 text-left">
                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase text-left">MI FICHA</h2>
                  {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="w-full md:w-auto bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg"><Edit2 size={18}/> Editar</button>
                  ) : (
                      <div className="flex gap-3 w-full md:w-auto text-left">
                          <button onClick={() => setIsEditing(false)} className="flex-1 md:flex-none bg-white border border-gray-300 px-5 py-2.5 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 shadow-sm text-left">Cancelar</button>
                          <button onClick={handleSaveProfile} disabled={saveLoading} className="flex-1 md:flex-none bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg text-left">{saveLoading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Confirmar</button>
                      </div>
                  )}
              </div>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden p-5 md:p-8 text-left">
                  <div className="mb-6 border-b border-gray-200 pb-2 text-left"><h3 className="flex items-center gap-2 text-[10px] md:text-xs font-black text-indigo-700 uppercase tracking-widest text-left"><ShieldCheck size={16}/> Datos de Cuenta</h3></div>
                  <div className="mb-6 text-left">
                      <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase ml-1 text-left">Email</label>
                      <input disabled={!isEditing} type="email" value={isEditing ? formData.email : user.email} onChange={e => setFormData({...formData, email: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none transition text-left ${isEditing ? 'border-gray-400 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`}/>
                  </div>

                  {/* SECCIÓN RESPONSABLE DE PAGOS EN EL PERFIL */}
                  <div className="mb-6 border-b border-gray-200 pb-2 text-left"><h3 className="flex items-center gap-2 text-[10px] md:text-xs font-black text-indigo-700 uppercase tracking-widest text-left"><CreditCard size={16}/> Responsable de Pagos</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div className="space-y-1 text-left">
                          <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1 text-left">Nombre del Pagador</label>
                          <input disabled={!isEditing} type="text" value={isEditing ? formData.payer_name : (user.payer_name || '')} onChange={e => setFormData({...formData, payer_name: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none transition text-left ${isEditing ? 'border-gray-400 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} placeholder="Ej: Padre/Madre/Tutor"/>
                      </div>
                      <div className="space-y-1 text-left">
                          <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1 text-left">CUIL del Pagador</label>
                          <input disabled={!isEditing} type="text" value={isEditing ? formData.payer_cuil : (user.payer_cuil || '')} onChange={e => handlePayerCuilChange(e.target.value)} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none transition text-left ${isEditing ? 'border-gray-400 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} placeholder="20-XXXXXXXX-X"/>
                      </div>
                  </div>

                  <div className="mt-8 mb-6 border-b border-gray-200 pb-2 text-left"><h3 className="flex items-center gap-2 text-[10px] md:text-xs font-black text-indigo-700 uppercase tracking-widest text-left"><User size={16}/> Información Personal</h3></div>
                  <div className="space-y-4 text-left">
                      <div className="grid grid-cols-1 gap-4 text-left">
                          <label className="block text-[10px] font-bold text-gray-700 -mb-3 ml-1 uppercase text-left">Nombre Completo</label>
                          <input disabled={!isEditing} type="text" value={isEditing ? formData.name : user.name} onChange={e => setFormData({...formData, name: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none text-left ${isEditing ? 'bg-white border-gray-400 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}/>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                          <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1 text-left">CUIL</label>
                              <input 
                                disabled={!isEditing} 
                                type="text" 
                                value={isEditing ? formData.cuil : user.cuil} 
                                onChange={e => handleCuilChange(e.target.value)} 
                                className={`w-full p-3 border rounded-xl font-bold text-sm outline-none text-left ${isEditing ? 'bg-white border-gray-400 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                                placeholder="20-44667874-5"
                              />
                          </div>
                          <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1 text-left">Fecha de Nacimiento</label>
                              <input disabled={!isEditing} type="date" value={isEditing ? (formData.birth_date || '') : (user.birth_date || '')} onChange={e => setFormData({...formData, birth_date: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none text-left ${isEditing ? 'bg-white border-gray-400 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}/>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                          <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1 text-left">Teléfono</label>
                              <input disabled={!isEditing} type="text" value={isEditing ? formData.phone : user.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none text-left ${isEditing ? 'bg-white border-gray-400 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}/>
                          </div>
                          <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1 text-left">Género</label>
                              {isEditing ? (
                                  <select value={formData.gender || ''} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full p-3 border border-gray-400 rounded-xl font-bold text-gray-900 text-sm outline-none bg-white text-left">
                                      <option value="">Género...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option>
                                  </select>
                              ) : ( <div className="w-full p-3 border border-gray-200 bg-gray-50 rounded-xl font-bold text-gray-900 text-sm text-left">{formData.gender || '-'}</div> )}
                          </div>
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1 text-left">Dirección</label>
                        <input disabled={!isEditing} type="text" value={isEditing ? formData.address : user.address} onChange={e => setFormData({...formData, address: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none text-left ${isEditing ? 'bg-white border-gray-400 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}/>
                      </div>
                  </div>
                  <div className="mt-8 mb-6 border-b border-red-200 pb-2 text-left"><h3 className="flex items-center gap-2 text-[10px] md:text-xs font-black text-red-600 uppercase tracking-widest text-left"><Shield size={16}/> Emergencia y Salud</h3></div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-6 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-left">
                          <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-red-900 uppercase ml-1 text-left">Contacto</label>
                              <input disabled={!isEditing} type="text" value={isEditing ? formData.emergency_contact : user.emergency_contact} onChange={e => setFormData({...formData, emergency_contact: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none text-left ${isEditing ? 'bg-white border-red-400 text-gray-900' : 'bg-red-100/50 border-red-200 text-gray-900'}`}/>
                          </div>
                          <div className="space-y-1 text-left">
                              <label className="block text-[10px] font-bold text-red-900 uppercase ml-1 text-left">Tel. Emergencia</label>
                              <input disabled={!isEditing} type="text" value={isEditing ? formData.emergency_phone : user.emergency_phone} onChange={e => setFormData({...formData, emergency_phone: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none text-left ${isEditing ? 'bg-white border-red-400 text-gray-900' : 'bg-red-100/50 border-red-200 text-gray-900'}`}/>
                          </div>
                      </div>
                      <div className="space-y-1 text-left">
                          <label className="block text-[10px] font-bold text-red-900 uppercase ml-1 text-left">Observaciones Médicas</label>
                          <textarea disabled={!isEditing} rows={3} value={isEditing ? (formData.medical_conditions || '') : (user.medical_conditions || '')} onChange={e => setFormData({...formData, medical_conditions: e.target.value})} className={`w-full p-3 border rounded-xl font-bold text-sm outline-none transition resize-none text-left ${isEditing ? 'bg-white border-red-400 text-gray-900' : 'bg-red-100/50 border-red-200 text-gray-900'}`}></textarea>
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-[9px] md:text-[10px] text-gray-600 space-y-3 leading-relaxed text-justify mb-4 font-medium text-left">
                      <p className="text-left"><strong>1. RESPONSABLE:</strong> Club La Cantera.</p>
                      <p className="text-left"><strong>2. FINALIDAD:</strong> Gestión administrativa y emergencias médicas.</p>
                      <p className="text-left"><strong>3. CONSENTIMIENTO:</strong> Al usar este sistema, acepta el tratamiento de datos conforme a la Ley 25.326.</p>
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2 text-left"><CheckCircle size={14} className="text-indigo-600 shrink-0"/><span className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight text-left">Política de Privacidad aceptada.</span></div>
                  </div>
              </div>
           </div>
        )}

        {activeTab === 'payment' && (
           <div className="max-w-lg mx-auto py-6 md:py-10 animate-in fade-in slide-in-from-bottom-4 text-left">
              {!uploadSuccess ? (
                  <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100 text-center text-left">
                      <div className="h-12 w-12 md:h-16 md:w-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-center"><Upload size={28}/></div>
                      <h2 className="text-xl md:text-2xl font-black text-gray-900 uppercase mb-1 text-center">Informar Pago</h2>
                      <p className="text-gray-500 text-xs md:text-sm mb-6 md:mb-8 text-center">Adjuntá el comprobante de transferencia.</p>
                      <form onSubmit={handlePaymentSubmit} className="space-y-5 md:space-y-6 text-left">
                          <div className="text-left">
                              <label className="block text-[10px] font-bold text-gray-600 uppercase mb-2 text-left">Monto ($)</label>
                              <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full p-3 md:p-4 text-xl md:text-2xl font-black border-2 border-gray-200 rounded-xl outline-none focus:border-orange-500 text-gray-900 placeholder-gray-400 text-left" 
                                placeholder="0.00" 
                                required
                              />
                              {amount && (
                                <p className="mt-2 text-[10px] font-bold text-orange-600 animate-pulse bg-orange-50 p-2 rounded-lg border border-orange-100 flex items-center gap-2 text-left">
                                  ⚠️ Pago informado: <span className="text-xs text-left">${Number(amount).toLocaleString()}</span>
                                </p>
                              )}
                          </div>
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center relative cursor-pointer hover:bg-gray-50 text-left">
                              <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer text-left"/>
                              {file ? <span className="font-bold text-green-600 text-xs flex items-center justify-center gap-2 break-all text-center"><CheckCircle size={16} className="shrink-0 text-center"/> {file.name}</span> : <span className="text-gray-400 font-bold text-xs uppercase text-center">Subir imagen o PDF</span>}
                          </div>
                          <button type="submit" disabled={uploading} className="w-full bg-orange-600 text-white py-4 rounded-xl font-black uppercase hover:bg-orange-700 transition shadow-lg disabled:bg-gray-400 text-sm text-center">{uploading ? <Loader2 className="animate-spin mx-auto text-center"/> : 'ENVIAR COMPROBANTE'}</button>
                      </form>
                  </div>
              ) : (
                  <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl text-center border-t-4 border-green-500 text-center"><CheckCircle size={50} className="text-green-500 mx-auto mb-4 text-center"/><h2 className="text-xl md:text-2xl font-black text-gray-900 uppercase text-center">¡Enviado!</h2><p className="text-gray-500 text-sm mb-6 text-center">Tu pago está en revisión.</p><button onClick={() => setUploadSuccess(false)} className="text-indigo-600 font-bold hover:underline text-sm text-center text-left">Nuevo pago</button></div>
              )}
           </div>
        )}
      </main>
    </div>
  )
}