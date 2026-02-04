'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Search, Eye, Trash2, Loader2, X, Calendar, Filter } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  const [dateFilter, setDateFilter] = useState<'current' | 'last' | 'year'>('current')
  
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [genderFilter, setGenderFilter] = useState<string>('all')

  useEffect(() => {
    fetchPayments()
  }, [dateFilter])

  const fetchPayments = async () => {
    setLoading(true)
    try {
        const now = new Date()
        let startDate = startOfMonth(now).toISOString()
        let endDate = endOfMonth(now).toISOString()

        if (dateFilter === 'last') {
            const lastMonth = subMonths(now, 1)
            startDate = startOfMonth(lastMonth).toISOString()
            endDate = endOfMonth(lastMonth).toISOString()
        } else if (dateFilter === 'year') {
            startDate = startOfYear(now).toISOString()
            endDate = now.toISOString()
        }

        const { data, error } = await supabase
            .from('payments')
            .select('*, users!inner(name, email, dni, category, gender)')
            .neq('method', 'cuota')
            .gte('date', startDate)
            .lte('date', endDate)
            .or('status.eq.approved,status.eq.completed,method.eq.adjustment')
            .order('date', { ascending: false })
            .limit(500)

        if (error) throw error
        setPayments(data || [])
    } catch (error) {
        console.error('Error al cargar pagos:', error)
    } finally {
        setLoading(false)
    }
  }

  const handleDelete = async (id: string, amount: number, userId: string) => {
      if (!confirm('¿Estás seguro de eliminar este registro? Se ajustará el saldo del jugador.')) return

      try {
          const { error: deleteError } = await supabase.from('payments').delete().eq('id', id)
          if (deleteError) throw deleteError

          const adjustment = -amount 
          const { data: user } = await supabase.from('users').select('account_balance').eq('id', userId).single()
          if (user) {
              await supabase.from('users').update({
                  account_balance: user.account_balance + adjustment
              }).eq('id', userId)
          }
          fetchPayments()
      } catch (error) {
          alert('Error al eliminar.')
      }
  }

  const getMethodLabel = (method: string) => {
      const m = method?.toLowerCase() || ''
      if (m.includes('transfer')) return { text: 'Transferencia', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
      if (m.includes('cash') || m.includes('efectivo')) return { text: 'Efectivo', color: 'text-green-700 bg-green-50 border-green-200' }
      if (m.includes('adjust') || m.includes('ajuste')) return { text: 'Ajuste Manual', color: 'text-blue-700 bg-blue-50 border-blue-200' }
      return { text: 'Efectivo', color: 'text-gray-700 bg-gray-50 border-gray-200' }
  }

  const filteredPayments = payments.filter(p => {
      const user = Array.isArray(p.users) ? p.users[0] : p.users
      const name = user?.name?.toLowerCase() || ''
      const dni = user?.dni || ''
      const category = user?.category || ''
      const gender = user?.gender || ''

      const matchesSearch = name.includes(searchTerm.toLowerCase()) || dni.includes(searchTerm)
      const matchesCategory = categoryFilter === 'all' || category === categoryFilter
      
      const matchesGender = genderFilter === 'all' || 
        (gender && gender.toLowerCase().trim() === genderFilter.toLowerCase().trim())

      return matchesSearch && matchesCategory && matchesGender
  })

  const totalRevenue = filteredPayments
    .filter(p => p.amount > 0 && p.method !== 'adjustment')
    .reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <div className="space-y-6 min-h-screen pb-10 font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de Pagos</h1>
            <p className="text-gray-500 text-sm mt-1">
                Total recaudado: <span className="text-green-600 font-bold">${totalRevenue.toLocaleString()}</span>
            </p>
        </div>
        
        <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 py-2 shadow-sm hover:border-gray-400 transition">
            <Calendar size={16} className="text-gray-500 mr-2"/>
            <select 
                className="bg-transparent font-bold text-gray-700 outline-none text-sm cursor-pointer pr-2" 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value as any)}
            >
                <option value="current">Este Mes</option>
                <option value="last">Mes Pasado</option>
                <option value="year">Todo el Año</option>
            </select>
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                  <input 
                      type="text" 
                      className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-900 placeholder-gray-500" 
                      placeholder="Buscar por nombre o DNI..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                      <Filter size={14} className="text-gray-400"/>
                      <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer"
                      >
                          <option value="all">Categorías</option>
                          <option value="Infantiles">Infantiles</option>
                          <option value="Menores">Menores</option>
                          <option value="Cadetes">Cadetes</option>
                          <option value="Juveniles">Juveniles</option>
                          <option value="Mayores">Mayores</option>
                      </select>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                      <select 
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value)}
                        className="bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer"
                      >
                          <option value="all">Sexo</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                      </select>
                  </div>

                  <div className="px-4 py-2 bg-indigo-50 text-xs font-bold text-indigo-600 rounded-lg border border-indigo-100">
                      {filteredPayments.length} Registros
                  </div>
              </div>
          </div>
      </div>

      {/* TABLA PARA ESCRITORIO (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <th className="p-4">Fecha</th>
                          <th className="p-4">Jugador</th>
                          <th className="p-4">Detalle</th>
                          <th className="p-4">Método</th>
                          <th className="p-4 text-right">Monto</th>
                          <th className="p-4 text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {loading ? (
                          <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600"/></td></tr>
                      ) : filteredPayments.length === 0 ? (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-400 text-sm">No se encontraron pagos.</td></tr>
                      ) : (
                          filteredPayments.map((payment) => {
                              const user = Array.isArray(payment.users) ? payment.users[0] : payment.users
                              const style = getMethodLabel(payment.method)
                              const isAdjustment = payment.method === 'adjustment'
                              const isPositive = payment.amount > 0
                              const amountColor = isAdjustment ? 'text-blue-600' : (isPositive ? 'text-green-600' : 'text-blue-600')
                              const showEye = payment.method?.includes('transfer') && payment.proof_url
                              const rawGender = user?.gender ? String(user.gender).toUpperCase().trim() : ''
                              const isMale = rawGender.startsWith('M')
                              const hasGender = rawGender.length > 0

                              return (
                                  <tr key={payment.id} className="hover:bg-gray-50 transition">
                                      <td className="p-4 text-xs font-medium text-gray-500">
                                          {format(parseISO(payment.date), 'dd/MM/yyyy')}
                                      </td>
                                      <td className="p-4">
                                          <p className="font-bold text-gray-900 text-sm">{user?.name || 'Usuario Eliminado'}</p>
                                          <p className="text-xs text-gray-400">{user?.email}</p>
                                      </td>
                                      <td className="p-4">
                                          <div className="flex gap-1 flex-wrap">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold border border-gray-200">{user?.category || '-'}</span>
                                            {hasGender && (
                                                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isMale ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-pink-50 text-pink-600 border-pink-100'}`}>
                                                    {isMale ? 'M' : 'F'}
                                                 </span>
                                            )}
                                          </div>
                                      </td>
                                      <td className="p-4">
                                          <div className="flex items-center gap-2">
                                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${style.color}`}>
                                                  {style.text}
                                              </span>
                                              {showEye && (
                                                  <button 
                                                    onClick={() => setPreviewUrl(payment.proof_url)}
                                                    className="text-indigo-600 hover:text-indigo-800 transition bg-indigo-50 p-1 rounded-full"
                                                  >
                                                      <Eye size={14}/>
                                                  </button>
                                              )}
                                          </div>
                                      </td>
                                      <td className={`p-4 text-right font-black text-sm ${amountColor}`}>
                                          {isPositive ? '+' : ''}${payment.amount.toLocaleString()}
                                      </td>
                                      <td className="p-4 text-center">
                                          <button 
                                            onClick={() => handleDelete(payment.id, payment.amount, payment.user_id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                          >
                                              <Trash2 size={16}/>
                                          </button>
                                      </td>
                                  </tr>
                              )
                          })
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* VISTA PARA CELULARES (md:hidden) */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600"/></div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">No se encontraron pagos.</div>
        ) : (
          filteredPayments.map((payment) => {
            const user = Array.isArray(payment.users) ? payment.users[0] : payment.users
            const style = getMethodLabel(payment.method)
            const isAdjustment = payment.method === 'adjustment'
            const isPositive = payment.amount > 0
            const amountColor = isAdjustment ? 'text-blue-600' : (isPositive ? 'text-green-600' : 'text-blue-600')
            const showEye = payment.method?.includes('transfer') && payment.proof_url

            return (
              <div key={payment.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {format(parseISO(payment.date), 'dd/MM/yyyy')}
                    </p>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight mt-0.5">{user?.name || 'Usuario Eliminado'}</h3>
                  </div>
                  <div className={`text-right font-black text-base ${amountColor}`}>
                    {isPositive ? '+' : ''}${payment.amount.toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                  <div className="flex gap-1.5">
                    <span className="px-2 py-0.5 bg-white text-gray-600 rounded text-[10px] font-bold border border-gray-200">{user?.category || '-'}</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${style.color}`}>
                      {style.text}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {showEye && (
                      <button 
                        onClick={() => setPreviewUrl(payment.proof_url)}
                        className="text-indigo-600 bg-white border border-indigo-100 p-1.5 rounded-lg shadow-sm"
                      >
                        <Eye size={16}/>
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(payment.id, payment.amount, payment.user_id)}
                      className="text-gray-400 bg-white border border-gray-100 p-1.5 rounded-lg shadow-sm active:text-red-600"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* MODAL COMPROBANTE (IGUAL) */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setPreviewUrl(null)}>
            <div className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900 text-sm uppercase">Comprobante</h3>
                    <button onClick={() => setPreviewUrl(null)} className="p-1 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center">
                    <img src={previewUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" alt="Comprobante"/>
                </div>
            </div>
        </div>
      )}

    </div>
  )
}