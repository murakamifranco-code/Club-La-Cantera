'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, ShieldCheck, X, FileText, User, HeartPulse, ShieldAlert, MapPin, Phone, Calendar } from 'lucide-react'

export default function Register() {
  const router = useRouter()
  
  // ESTADO COMPLETO (Con la corrección de phone incluida)
  const [formData, setFormData] = useState({
      email: '', password: '', name: '', dni: '', phone: '',
      birth_date: '', address: '', gender: '',
      emergency_contact_name: '', emergency_contact: '', medical_notes: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // ESTADOS LEGALES
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!acceptedTerms) {
        setError("Debés aceptar los Términos y la Política de Privacidad para continuar.")
        return
    }

    setLoading(true)

    try {
      // 1. Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) throw authError

      if (authData.user) {
        // 2. Crear perfil COMPLETO en tabla 'users'
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          dni: formData.dni,
          phone: formData.phone,
          role: 'player',
          status: 'active',
          account_balance: 0,
          terms_accepted_at: new Date().toISOString(),
          // GUARDAMOS TODOS LOS DATOS NUEVOS
          birth_date: formData.birth_date,
          address: formData.address,
          gender: formData.gender,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact: formData.emergency_contact,
          medical_notes: formData.medical_notes
        })

        if (profileError) throw profileError

        localStorage.setItem('club_player_id', authData.user.id)
        router.push('/portal/dashboard')
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrarse. Verificá los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    // AQUÍ ESTÁ EL CAMBIO DE FONDO (Gradiente Azul a Naranja)
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-orange-500 p-4 font-sans py-12">
      
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl animate-in zoom-in-95 duration-300">
        
        <div className="text-center mb-10">
            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-orange-500 shadow-sm overflow-hidden">
                <img src="/logo.png" alt="Club" className="h-16 w-16 object-contain" onError={(e) => e.currentTarget.style.display = 'none'}/>
            </div>
            <h1 className="text-3xl font-black text-gray-900 uppercase italic tracking-tight">Alta de Socio</h1>
            <p className="text-gray-500 mt-2 text-lg">Completá tu ficha para unirte al club.</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 rounded-r-lg">
            <AlertCircle size={20} />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* SECCIÓN 1: DATOS DE CUENTA */}
          <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-black text-gray-900 uppercase text-sm border-b pb-2 mb-4">
                  <ShieldCheck size={18} className="text-indigo-600"/> Datos de Cuenta
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                    <input type="email" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900" placeholder="tu@email.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña</label>
                    <input type="password" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900" placeholder="Mínimo 6 caracteres" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>
          </div>

          {/* SECCIÓN 2: DATOS PERSONALES */}
          <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-black text-gray-900 uppercase text-sm border-b pb-2 mb-4 mt-8">
                  <User size={18} className="text-indigo-600"/> Información Personal
              </h3>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                <input type="text" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900" placeholder="Ej: Lionel Messi" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">DNI</label>
                    <input type="number" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900" placeholder="Sin puntos" value={formData.dni} onChange={(e) => setFormData({...formData, dni: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Calendar size={14}/> Fecha de Nacimiento</label>
                    <input type="date" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900" value={formData.birth_date} onChange={(e) => setFormData({...formData, birth_date: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone size={14}/> Teléfono / Celular</label>
                    <input type="text" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900" placeholder="Ej: 223 555..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><User size={14}/> Género</label>
                    <select required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900 bg-white" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                        <option value="">Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="X">Otro</option>
                    </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><MapPin size={14}/> Dirección / Domicilio</label>
                <input type="text" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-gray-900" placeholder="Ej: Av. Luro 1234" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              </div>
          </div>

          {/* SECCIÓN 3: EMERGENCIA Y SALUD */}
          <div className="space-y-4 bg-red-50 p-4 rounded-xl border border-red-100">
              <h3 className="flex items-center gap-2 font-black text-red-700 uppercase text-sm border-b border-red-200 pb-2 mb-4">
                  <ShieldAlert size={18} className="text-red-600"/> Emergencia y Salud
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs font-bold text-red-700 uppercase mb-1">Contacto de Emergencia (Nombre)</label>
                      <input type="text" required className="w-full p-3 border-2 border-red-200 rounded-xl focus:border-red-500 outline-none font-bold text-gray-900 bg-white" placeholder="Ej: Padre/Madre/Tutor" value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-red-700 uppercase mb-1">Teléfono de Emergencia</label>
                      <input type="text" required className="w-full p-3 border-2 border-red-200 rounded-xl focus:border-red-500 outline-none font-bold text-gray-900 bg-white" placeholder="Ej: 223 155..." value={formData.emergency_contact} onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})} />
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-red-700 uppercase mb-1 flex items-center gap-1"><HeartPulse size={14}/> Observaciones Médicas / Alergias</label>
                  <textarea className="w-full p-3 border-2 border-red-200 rounded-xl focus:border-red-500 outline-none font-bold text-gray-900 bg-white" rows={3} placeholder="Opcional: Alergias, condiciones, etc." value={formData.medical_notes} onChange={(e) => setFormData({...formData, medical_notes: e.target.value})} />
              </div>
          </div>

          {/* CHECKBOX LEGAL */}
          <div className="flex items-start gap-3 bg-gray-100 p-4 rounded-xl border border-gray-200">
              <input id="terms" type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="w-6 h-6 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer mt-1" />
              <div className="text-sm">
                <label htmlFor="terms" className="font-bold text-gray-800 cursor-pointer">
                  Declaro que los datos son reales y acepto la <span className="text-indigo-600 underline" onClick={(e) => {e.preventDefault(); setShowTermsModal(true)}}>Política de Privacidad y Tratamiento de Datos Personales y de Salud.</span>
                </label>
              </div>
          </div>

          <button type="submit" disabled={loading || !acceptedTerms} className="w-full py-5 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 transition shadow-xl disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed uppercase tracking-wide text-lg flex justify-center items-center gap-3">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Confirmar Registro'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href="/portal" className="text-base font-bold text-gray-500 hover:text-indigo-600 transition">
            ¿Ya tenés cuenta? <span className="underline">Iniciá Sesión</span>
          </Link>
        </div>
      </div>

      {/* MODAL DE TÉRMINOS */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-gray-900 flex items-center gap-2"><FileText size={20} className="text-indigo-600"/> TÉRMINOS Y CONDICIONES</h3>
                    <button onClick={() => setShowTermsModal(false)} className="p-1 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto text-sm text-gray-600 space-y-4 leading-relaxed">
                    <p className="font-bold text-gray-900">1. RESPONSABLE DE LOS DATOS</p>
                    <p>Los datos personales recabados serán incorporados a una base de datos bajo la responsabilidad del <strong>Club La Cantera</strong>.</p>
                    <p className="font-bold text-gray-900">2. FINALIDAD Y DATOS SENSIBLES</p>
                    <p>Se recolectan datos personales y de salud (ficha médica, alergias, contactos de emergencia) con la única finalidad de la gestión administrativa, deportiva y para la atención de emergencias médicas durante las actividades del Club.</p>
                    <p className="font-bold text-gray-900">3. CONSENTIMIENTO</p>
                    <p>Al aceptar, usted presta su <strong>consentimiento expreso e informado</strong> para el tratamiento de sus datos personales y sensibles conforme a la Ley 25.326 de Protección de Datos Personales.</p>
                </div>
                <div className="p-4 border-t bg-gray-50 text-center">
                    <button onClick={() => {setAcceptedTerms(true); setShowTermsModal(false)}} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition">Entendido, Aceptar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}