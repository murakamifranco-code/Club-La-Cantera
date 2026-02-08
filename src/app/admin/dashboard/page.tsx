'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { DollarSign, Search, CreditCard, Loader2, Calendar, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { format, parseISO, startOfMonth, subMonths, startOfYear, endOfMonth } from 'date-fns'

export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState<'current' | 'last' | 'year'>('current')
  
  const [stats, setStats] = useState({ revenue: 0, debt: 0 })
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ESTADOS CAJA RÁPIDA
  const [quickPayUser, setQuickPayUser] = useState<any>(null)
  const [quickPayAmount, setQuickPayAmount] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [processing, setProcessing] = useState(false)
  const [notification, setNotification] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' })

  useEffect(() => {
    fetchDashboardData()
  }, [dateFilter])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ show: true, type, message })
      setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000)
  }

  const fetchDashboardData = async () => {
    setLoading(true)
    const now = new Date()
    
    let startDate: Date;
    let endDate: Date;

    if (dateFilter === 'last') {
        const lastMonth = subMonths(now, 1)
        startDate = startOfMonth(lastMonth)
        endDate = endOfMonth(lastMonth)
    } else if (dateFilter === 'year') {
        startDate = startOfYear(now)
        endDate = now
    } else {
        startDate = startOfMonth(now)
        endDate = now
    }

    const { data: movements } = await supabase.from('payments')
      .select('amount, method, date')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())

    const revenue = movements?.filter(m => 
      m.amount > 0 && (m.method === 'cash' || m.method === 'transfer')
    ).reduce((acc, curr) => acc + curr.amount, 0) || 0;

    const periodBalance = movements?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
    const periodDebt = periodBalance < 0 ? Math.abs(periodBalance) : 0;

    const { data: recent } = await supabase.from('payments')
      .select('*, users(name)')
      .gt('amount', 0)
      .in('method', ['cash', 'transfer'])
      .order('date', { ascending: false })
      .limit(5)

    setStats({ 
        revenue, 
        debt: periodDebt
    })
    setRecentPayments(recent || [])
    setLoading(false)
  }

  const handleSearch = async (term: string) => {
      setSearchTerm(term)
      if (term.length < 3) { setSearchResults([]); return }
      // CORRECCIÓN: Se cambia la búsqueda de 'dni' a 'cuil'
      const { data } = await supabase.from('users').select('id, name, cuil, account_balance, category, birth_date').eq('role', 'player').or(`name.ilike.%${term}%,cuil.ilike.%${term}%`).limit(5)
      setSearchResults(data || [])
  }

  const selectUser = (user: any) => { setQuickPayUser(user); setSearchTerm(''); setSearchResults([]) }

  const handleQuickPay = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!quickPayUser || !quickPayAmount) return
      setProcessing(true)
      try {
          const amount = parseFloat(quickPayAmount)

          const birthYear = quickPayUser.birth_date ? parseISO(quickPayUser.birth_date).getFullYear() : 0
          const currentYear = new Date().getFullYear()
          const age = currentYear - birthYear
          
          let automaticCategory = 'Mayores'
          if (age < 13) automaticCategory = 'Infantiles'
          else if (age <= 14) automaticCategory = 'Menores'
          else if (age <= 16) automaticCategory = 'Cadetes'
          else if (age <= 18) automaticCategory = 'Juveniles'

          const { error } = await supabase.from('payments').insert({ 
            user_id: quickPayUser.id, 
            amount: amount, 
            method: 'cash', 
            date: new Date().toISOString(), 
            status: 'completed',
            category_snapshot: automaticCategory 
          })

          if (error) throw error
          showToast(`Pago de $${amount} registrado para ${quickPayUser.name}`, 'success')
          setQuickPayUser(null); setQuickPayAmount(''); fetchDashboardData() 
      } catch (error) { showToast('Error al registrar pago.', 'error') } finally { setProcessing(false) }
  }

  const periodLabel = dateFilter === 'current' ? 'Este Mes' : (dateFilter === 'last' ? 'Mes Anterior' : 'Año Actual')

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>

  return (
    <div className="space-y-6 font-sans text-left">
      
      {/* HEADER + FILTRO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-left">
        <div className="text-left">
            <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
            <p className="text-gray-500 text-sm">Resumen de movimientos: <span className="font-semibold text-indigo-600">{periodLabel}</span></p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 py-2 shadow-sm hover:border-gray-400 transition text-left">
            <Calendar size={16} className="text-gray-500 mr-2"/>
            <select className="bg-transparent font-medium text-gray-600 outline-none text-sm cursor-pointer" value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)}>
                <option value="current">Este Mes</option>
                <option value="last">Mes Anterior</option>
                <option value="year">Todo el Año</option>
            </select>
        </div>
      </div>

      {/* TARJETAS RESTANTES - AJUSTADAS A 2 COLUMNAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-left">
              <div className="flex justify-between items-start text-left">
                  <div className="text-left">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recaudación</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-1">${stats.revenue.toLocaleString()}</h3>
                  </div>
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={20}/></div>
              </div>
              <p className="text-xs text-green-600 mt-4 font-medium flex items-center gap-1 text-left">Cobrado en este periodo</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-left">
              <div className="flex justify-between items-start text-left">
                  <div className="text-left">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Morosidad del Periodo</p>
                      <h3 className={`text-2xl font-bold mt-1 ${stats.debt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ${stats.debt.toLocaleString()}
                      </h3>
                  </div>
                  <div className="p-2 bg-red-50 text-red-500 rounded-lg"><AlertTriangle size={20}/></div>
              </div>
              <p className="text-xs text-gray-400 mt-4 font-medium text-left">Suma de deudas actuales</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full text-left">
              <h3 className="font-bold text-gray-700 mb-4 text-base text-left">Últimos Movimientos</h3>
              <div className="space-y-3 text-left">
                  {recentPayments.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No hay pagos registrados.</p> : recentPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition border border-transparent hover:border-gray-100 text-left">
                          <div className="flex items-center gap-3 text-left">
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">$</div>
                              <div className="text-left"><p className="text-sm font-bold text-gray-700">{p.users?.name || 'Usuario Borrado'}</p><p className="text-xs text-gray-400 font-medium">{format(parseISO(p.date), 'dd MMM - HH:mm')}</p></div>
                          </div>
                          <span className="font-bold text-green-600 text-sm text-left">+${p.amount.toLocaleString()}</span>
                      </div>
                  ))}
                  {recentPayments.length > 0 && <button onClick={() => window.location.href='/admin/payments'} className="w-full text-center text-xs text-indigo-600 font-bold mt-4 hover:text-indigo-800 uppercase tracking-wide">Ver historial completo →</button>}
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full text-left">
              <div className="flex items-center gap-2 mb-4 text-gray-700 text-left"><CreditCard size={20} className="text-indigo-600"/><h3 className="font-bold text-base text-left">Caja Rápida (Efectivo)</h3></div>
              <div className="space-y-4 text-left">
                  {!quickPayUser ? (
                      <div className="relative text-left">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 text-left">Buscar Jugador</label>
                          {/* CORRECCIÓN: Se cambia placeholder de DNI a CUIL */}
                          <div className="relative mt-1 text-left"><Search className="absolute left-3 top-3 text-gray-400" size={18}/><input type="text" placeholder="Escribí nombre o CUIL..." className="w-full pl-10 p-3 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 transition font-medium text-gray-700 placeholder-gray-400 text-left" value={searchTerm} onChange={(e) => handleSearch(e.target.value)}/></div>
                          {searchResults.length > 0 && (
                              <div className="absolute z-10 w-full bg-white border border-gray-200 mt-2 rounded-lg shadow-xl max-h-48 overflow-y-auto text-left">
                                  {searchResults.map(u => (
                                      <div key={u.id} onClick={() => selectUser(u)} className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-0 group text-left">
                                          <div className="text-left"><p className="font-bold text-sm text-gray-800 group-hover:text-indigo-700 text-left">{u.name}</p><p className="text-xs text-gray-500 text-left">CUIL: {u.cuil}</p></div>
                                          <div className={`text-xs font-bold px-2 py-1 rounded border ${u.account_balance < 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'} text-left`}>{u.account_balance < 0 ? `Debe $${Math.abs(u.account_balance)}` : 'Al día'}</div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="p-4 bg-white rounded-lg flex justify-between items-center border border-indigo-200 shadow-sm text-left">
                           <div className="flex items-center gap-3 text-left">
                               <div className="h-10 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg text-left">{quickPayUser.name.charAt(0)}</div>
                               <div className="text-left"><p className="font-bold text-gray-800 text-left">{quickPayUser.name}</p><p className={`text-xs font-semibold ${quickPayUser.account_balance < 0 ? 'text-red-500' : 'text-green-600'} text-left`}>Saldo actual: ${quickPayUser.account_balance}</p></div>
                           </div>
                           <button onClick={() => setQuickPayUser(null)} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-lg transition text-left"><XCircle size={20} /></button>
                      </div>
                  )}
                  <form onSubmit={handleQuickPay} className="text-left">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1 text-left">Monto Recibido</label>
                      <div className="relative mt-1 text-left"><span className="absolute left-3 top-3 text-gray-500 font-bold text-lg text-left">$</span><input type="number" required min="1" disabled={!quickPayUser} className="w-full pl-8 p-3 border border-gray-300 rounded-lg outline-none focus:border-green-500 transition font-bold text-xl text-gray-800 placeholder-gray-300 disabled:bg-gray-50 text-left" placeholder="0" value={quickPayAmount} onChange={(e) => setQuickPayAmount(e.target.value)}/></div>
                      <button disabled={!quickPayUser || !quickPayAmount || processing} className="w-full mt-4 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition shadow-md uppercase tracking-wide text-sm text-left">{processing ? <Loader2 className="animate-spin mx-auto text-center"/> : 'Ingresar Dinero'}</button>
                  </form>
              </div>
          </div>
      </div>
      {notification.show && (
            <div className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300 border-l-8 ${notification.type === 'success' ? 'bg-white border-green-500' : 'bg-white border-red-500'} text-left`}>
                <div className={`${notification.type === 'success' ? 'text-green-500' : 'text-red-500'} text-left`}>{notification.type === 'success' ? <CheckCircle size={28} /> : <XCircle size={28} />}</div>
                <div className="text-left"><h4 className={`font-bold uppercase text-xs tracking-wider ${notification.type === 'success' ? 'text-green-600' : 'text-red-600'} text-left`}>{notification.type === 'success' ? '¡Éxito!' : 'Error'}</h4><p className="font-semibold text-gray-700 text-sm text-left">{notification.message}</p></div>
            </div>
      )}
    </div>
  )
}