'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Search, UserPlus, Edit2, Loader2, DollarSign, X, ArrowDownCircle, ArrowUpCircle, UserCheck, Info, FileText, ShieldCheck, User, Shield, CheckCircle, Filter, Download } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'

// Interfaces
interface Player {
  id: string; name: string; email: string; status: string; role: string; dni?: string; phone?: string; address?: string; birth_date?: string; gender?: string; medical_notes?: string; emergency_contact?: string; emergency_contact_name?: string; account_balance: number;
}
interface Transaction { 
  id: string; 
  type: 'payment' | 'fee' | 'adjustment'; 
  amount: number; 
  date: string; 
  description: string; 
  notes?: string; 
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // --- ESTADOS DE FILTROS ---
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterGender, setFilterGender] = useState<string>('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStatementOpen, setIsStatementOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  
  const [playerToToggle, setPlayerToToggle] = useState<Player | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedPlayerForStatement, setSelectedPlayerForStatement] = useState<Player | null>(null)
  const [playerTransactions, setPlayerTransactions] = useState<Transaction[]>([])
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  
  const [formData, setFormData] = useState({ 
    name: '', email: '', dni: '', phone: '', address: '', 
    birth_date: '', gender: '', medical_notes: '', 
    emergency_contact: '', emergency_contact_name: '' 
  })

  const fetchPlayers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('users').select('*').eq('role', 'player').order('name', { ascending: true })
      if (error) throw error
      setPlayers(data || [])
    } catch (error) { console.error('Error:', error) } finally { setLoading(false) }
  }

  useEffect(() => { fetchPlayers() }, [])

  // --- LÓGICA DE FILTRADO BLINDADA (Corrección del error de cliente) ---
  const filteredPlayers = players.filter(p => {
    const name = p.name || "";
    const dni = p.dni || "";
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || dni.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchesGender = filterGender === 'all' || p.gender === filterGender;
    
    const pCategory = getCategory(p.birth_date);
    const matchesCategory = filterCategory === 'all' || pCategory === filterCategory;

    return matchesSearch && matchesStatus && matchesGender && matchesCategory;
  })

  // --- FUNCIÓN EXCEL (CSV con ;) ---
  const downloadExcel = () => {
    const headers = ['Nombre', 'DNI', 'Email', 'Categoria', 'Sexo', 'Estado', 'Saldo'];
    const rows = filteredPlayers.map(p => [
      p.name || '',
      p.dni || '',
      p.email || '',
      getCategory(p.birth_date),
      p.gender === 'male' ? 'Masculino' : p.gender === 'female' ? 'Femenino' : 'Otro',
      p.status === 'active' ? 'Activo' : 'Inactivo',
      p.account_balance || 0
    ].join(';'));

    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `socios_la_cantera_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleStatusClick = (player: Player) => {
      setPlayerToToggle(player)
      setIsStatusModalOpen(true)
  }

  const executeStatusChange = async () => {
      if (!playerToToggle) return
      setIsSubmitting(true)
      const newStatus = playerToToggle.status === 'active' ? 'inactive' : 'active'
      try {
          const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', playerToToggle.id)
          if (error) throw error
          setPlayers(players.map(p => p.id === playerToToggle.id ? { ...p, status: newStatus } : p))
          setIsStatusModalOpen(false)
          setPlayerToToggle(null)
      } catch (error) { alert('Error al procesar.') } finally { setIsSubmitting(false) }
  }

  const openStatement = async (player: Player) => {
      setSelectedPlayerForStatement(player)
      setIsStatementOpen(true)
      setPlayerTransactions([])
      
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', player.id)
        .or('status.eq.approved,status.eq.completed,method.eq.adjustment,method.eq.cuota')

      const transactions: Transaction[] = []
      
      paymentsData?.forEach(p => {
          if (p.method === 'adjustment') {
              transactions.push({
                  id: p.id, 
                  type: 'adjustment', 
                  amount: p.amount, 
                  date: p.date || p.created_at,
                  description: 'Ajuste Administrativo',
                  notes: p.notes 
              })
          } 
          else if (p.method === 'cuota') {
              const monthLabel = p.proof_url || '';
              transactions.push({
                  id: p.id, 
                  type: 'fee', 
                  amount: p.amount, 
                  date: p.date || p.created_at,
                  description: monthLabel.toLowerCase().includes('cuota') ? monthLabel : `Cuota Mensual ${monthLabel}`
              })
          }
          else {
              const isCash = !p.proof_url || p.payment_method === 'cash' || p.payment_method === 'efectivo';
              
              transactions.push({
                  id: p.id, 
                  type: 'payment', 
                  amount: p.amount, 
                  date: p.date || p.created_at,
                  description: isCash ? 'Pago (efectivo)' : 'Pago (transferencia)'
              })
          }
      })
      
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setPlayerTransactions(transactions)
  }

  const getCategory = (birthDateString?: string) => {
    if (!birthDateString) return '-'
    try {
        const birthYear = parseISO(birthDateString).getFullYear()
        const age = new Date().getFullYear() - birthYear 
        if (age < 13) return `Infantiles`
        if (age <= 14) return `Menores`
        if (age <= 16) return `Cadetes`
        if (age <= 18) return `Juveniles`
        return `Mayores`
    } catch (e) { return '-' }
  }

  const openModal = (player?: Player) => {
    if (player) { 
      setEditingPlayer(player)
      setFormData({ 
        name: player.name || '', email: player.email || '', dni: player.dni || '', 
        phone: player.phone || '', address: player.address || '', birth_date: player.birth_date || '', 
        gender: player.gender || '', medical_notes: player.medical_notes || '', 
        emergency_contact: player.emergency_contact || '', emergency_contact_name: player.emergency_contact_name || '' 
      })
    } else { 
      setEditingPlayer(null)
      setFormData({ name: '', email: '', dni: '', phone: '', address: '', birth_date: '', gender: '', medical_notes: '', emergency_contact: '', emergency_contact_name: '' }) 
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true)
    try {
      const { data: existingDni } = await supabase.from('users').select('id').eq('dni', formData.dni).neq('id', editingPlayer?.id || '').maybeSingle()
      if (existingDni) {
          alert('Error: Ya existe un socio registrado con este DNI.')
          setIsSubmitting(false); return
      }

      const calculatedCategory = getCategory(formData.birth_date);
      const dataToSave = { ...formData, category: calculatedCategory };

      if (editingPlayer) { 
        await supabase.from('users').update(dataToSave).eq('id', editingPlayer.id) 
      } 
      else { 
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.dni,
            options: {
              data: { full_name: formData.name, dni: formData.dni, role: 'player' }
            }
        })
        if (authError) throw authError
        if (authData.user) {
            await supabase.from('users').insert({ 
                ...dataToSave, id: authData.user.id, role: 'player', status: 'active', account_balance: 0
            })
        }
      }
      setIsModalOpen(false); fetchPlayers()
    } catch (error: any) { alert('Error: ' + error.message) } finally { setIsSubmitting(false) }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight text-gray-900">Socios</h1><p className="mt-2 text-gray-500">Gestión de socios del club.</p></div>
        <div className="flex gap-2">
          <button onClick={downloadExcel} className="inline-flex items-center justify-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><Download className="mr-2 h-4 w-4" /> Exportar</button>
          <button onClick={() => openModal()} className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"><UserPlus className="mr-2 h-4 w-4" /> Nuevo Socio</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Search className="h-5 w-5 text-gray-400" /></div>
          <input type="text" className="block w-full rounded-md border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm" placeholder="Buscar por nombre o DNI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-4 items-center">
           <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest"><Filter size={14}/> Filtros:</div>
           
           <select className="text-xs font-bold border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
             <option value="all">TODOS LOS ESTADOS</option>
             <option value="active">ACTIVOS</option>
             <option value="inactive">INACTIVOS</option>
           </select>

           <select className="text-xs font-bold border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
             <option value="all">TODAS LAS CATEGORÍAS</option>
             <option value="Infantiles">INFANTILES</option>
             <option value="Menores">MENORES</option>
             <option value="Cadetes">CADETES</option>
             <option value="Juveniles">JUVENILES</option>
             <option value="Mayores">MAYORES</option>
           </select>

           <select className="text-xs font-bold border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
             <option value="all">TODOS LOS SEXOS</option>
             <option value="male">MASCULINO</option>
             <option value="female">FEMENINO</option>
             <option value="other">OTRO</option>
           </select>
        </div>
      </div>

      {/* VISTA PARA ESCRITORIO */}
      <div className="hidden md:block overflow-hidden rounded-lg bg-white shadow border border-gray-200">
        {loading ? ( <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Socio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlayers.map((player) => {
                const birthYear = player.birth_date ? parseISO(player.birth_date).getFullYear() : '';
                return (
                <tr key={player.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4"><div className="flex items-center"><div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white uppercase bg-indigo-500`}>{player.name.charAt(0)}</div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{player.name}</div><div className="text-xs text-gray-500">{player.dni || player.email}</div></div></div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCategory(player.birth_date)} {birthYear && `(${birthYear})`}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className={`text-sm font-bold ${player.account_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{player.account_balance < 0 ? '-' : '+'}${Math.abs(player.account_balance).toLocaleString()}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><button onClick={() => handleStatusClick(player)} className={`px-2 py-1 text-xs font-medium rounded-full ${player.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}>{player.status === 'active' ? 'Activo' : 'Inactivo'}</button></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div className="flex justify-end gap-2"><button onClick={() => openStatement(player)} className="text-gray-500 hover:text-green-600 p-1 bg-gray-50 hover:bg-green-50 rounded-md transition" title="Ver Cuenta"><DollarSign size={18} /></button><button onClick={() => openModal(player)} className="text-gray-500 hover:text-indigo-600 p-1 bg-gray-50 hover:bg-indigo-50 rounded-md transition" title="Editar Socio"><Edit2 size={18} /></button></div></td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {/* VISTA PARA CELULARES */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
        ) : (
          filteredPlayers.map((player) => (
            <div key={player.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-white uppercase bg-indigo-500 text-lg shadow-sm">
                    {player.name ? player.name.charAt(0) : '?'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{player.name}</h3>
                    <p className="text-[11px] text-gray-500 font-medium uppercase tracking-tighter">{player.dni || 'SIN DNI'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleStatusClick(player)} 
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm border ${player.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                >
                  {player.status === 'active' ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-3">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Categoría</p>
                  <p className="text-xs font-bold text-gray-700">{getCategory(player.birth_date)}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Saldo</p>
                  <p className={`text-xs font-black ${player.account_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {player.account_balance < 0 ? '-' : '+'}${Math.abs(player.account_balance).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => openStatement(player)} 
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition"
                >
                  <DollarSign size={14} /> Cuenta
                </button>
                <button 
                  onClick={() => openModal(player)} 
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition"
                >
                  <Edit2 size={14} /> Editar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODALS - SE MANTIENEN IGUAL */}
      {isStatementOpen && selectedPlayerForStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b flex justify-between bg-gray-50">
                    <div><h2 className="text-xl font-bold text-gray-900">{selectedPlayerForStatement.name}</h2><p className="text-sm text-gray-500 uppercase font-bold tracking-tighter">Estado de Cuenta</p></div>
                    <button onClick={() => setIsStatementOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                </div>
                <div className="p-6 text-center border-b">
                  <span className={`text-4xl font-black tracking-tight ${selectedPlayerForStatement.account_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{selectedPlayerForStatement.account_balance < 0 ? '-' : '+'}${Math.abs(selectedPlayerForStatement.account_balance).toLocaleString()}</span>
                  <p className="text-sm text-gray-500 mt-1 uppercase font-bold">Saldo Confirmado</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                    {playerTransactions.length === 0 ? (<p className="text-center text-gray-400 text-sm py-4 uppercase font-bold">Sin movimientos confirmados.</p>) : (
                        playerTransactions.map((t) => (
                            <div key={t.id} className="bg-white p-3 rounded shadow-sm border flex justify-between items-center transition hover:shadow-md">
                                <div className="flex gap-3 items-center">
                                    <div className={`p-2 rounded-full ${t.type === 'payment' ? 'bg-green-100 text-green-600' : (t.type === 'adjustment' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600')}`}>
                                        {t.type === 'payment' ? <ArrowUpCircle size={20}/> : (t.type === 'adjustment' ? <FileText size={20}/> : <ArrowDownCircle size={20}/>)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">{t.description}</p>
                                        {t.type === 'adjustment' && t.notes && (
                                            <p className="text-[10px] text-gray-400 italic uppercase font-medium">{t.notes}</p>
                                        )}
                                        <p className="text-xs text-gray-400">{format(parseISO(t.date), 'dd/MM/yyyy')}</p>
                                    </div>
                                </div>
                                <span className={`font-black text-sm ${
                                    t.type === 'adjustment' ? 'text-blue-600' : 
                                    t.type === 'fee' ? 'text-red-600' : 
                                    'text-green-600'
                                }`}>
                                    {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toLocaleString()}
                                </span>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end"><button onClick={() => setIsStatementOpen(false)} className="px-6 py-2 bg-white border border-gray-300 rounded-md text-gray-700 font-bold hover:bg-gray-100 shadow-sm transition">CERRAR</button></div>
            </div>
        </div>
      )}

      {isStatusModalOpen && playerToToggle && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">{playerToToggle.status === 'active' ? 'Dar de Baja' : 'Reactivar Socio'}</h3>
                    <button onClick={() => setIsStatusModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                <div className="p-6 text-center">
                    <p className="text-gray-600 mb-6 text-left">Cambiar estado de <strong>{playerToToggle.name}</strong> a:</p>
                    <div className={`w-full py-4 rounded-xl font-black uppercase tracking-wider shadow-sm border-2 mb-6 ${playerToToggle.status === 'active' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>{playerToToggle.status === 'active' ? 'INACTIVO (Baja)' : 'ACTIVO (Alta)'}</div>
                    <p className="mt-4 text-[11px] text-gray-400 text-center uppercase font-bold tracking-tight">* Los socios inactivos no recibirán cargos automáticos de cuotas.</p>
                </div>
                <div className="p-5 bg-gray-50 border-t flex justify-end gap-3"><button onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition">Cancelar</button><button onClick={executeStatusChange} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition">{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirmar'}</button></div>
            </div>
         </div>
      )}

      {/* EL RESTO DE MODALES SE MANTIENEN IGUAL (Nuevo/Editar Socio, etc) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-black text-gray-900 uppercase italic tracking-tight">{editingPlayer ? 'Editar Socio' : 'Nuevo Socio'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div>
                  <div className="mb-2 border-b border-gray-200 pb-1 flex items-center gap-2">
                    <h3 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14}/> Acceso</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1">Email Principal</label>
                      <input required type="email" placeholder="usuario@gmail.com" className="w-full p-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500 transition bg-white" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                  </div>
              </div>
              <div>
                  <div className="mb-2 border-b border-gray-200 pb-1 flex items-center gap-2">
                    <h3 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Personal</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1">Nombre Completo</label>
                      <input required type="text" placeholder="Juan Pérez" className="w-full p-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500 transition bg-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1">DNI (Único)</label>
                        <input required type="text" placeholder="12345678" className="w-full p-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500 transition bg-white" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1">Nacimiento</label>
                        <input required type="date" className="w-full p-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500 transition bg-white" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1">Teléfono</label>
                        <input required type="text" placeholder="223445566" className="w-full p-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500 transition bg-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1">Género</label>
                        <select required className="w-full p-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500 transition bg-white" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                          <option value="">...</option>
                          <option value="male">Masculino</option>
                          <option value="female">Femenino</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase ml-1">Dirección</label>
                      <input required type="text" placeholder="Av. Colón 123" className="w-full p-2 border border-gray-300 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500 transition bg-white" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                  </div>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="mb-2 border-b border-red-200 pb-1 flex items-center gap-2">
                  <h3 className="text-[10px] font-black text-red-700 uppercase tracking-widest flex items-center gap-2"><Shield size={14}/> Salud</h3>
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-red-900 uppercase ml-1">Contacto</label>
                        <input required type="text" placeholder="Mamá" className="w-full p-2 border border-red-200 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-red-500 transition bg-white" value={formData.emergency_contact_name} onChange={e => setFormData({...formData, emergency_contact_name: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-red-900 uppercase ml-1">Tel. Emerg.</label>
                        <input required type="text" placeholder="223..." className="w-full p-2 border border-red-200 rounded-lg font-bold text-xs text-gray-900 outline-none focus:ring-1 focus:ring-red-500 transition bg-white" value={formData.emergency_contact} onChange={e => setFormData({...formData, emergency_contact: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-red-900 uppercase ml-1">Ficha Médica</label>
                      <textarea required rows={2} placeholder="Alergias..." className="w-full p-2 border border-red-200 rounded-lg font-bold text-xs text-gray-900 outline-none transition resize-none focus:ring-1 focus:ring-red-500 bg-white" value={formData.medical_notes} onChange={e => setFormData({...formData, medical_notes: e.target.value})} />
                    </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t bg-gray-50 -m-5 mt-2 p-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs hover:bg-white transition shadow-sm">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-black uppercase text-xs tracking-wider hover:bg-indigo-700 transition shadow-lg flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin h-3 w-3" /> : editingPlayer ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}