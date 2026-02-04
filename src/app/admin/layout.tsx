'use client'

import { useState } from 'react' // Única adición para controlar el menú móvil
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, CreditCard, FileText, Inbox, LogOut, Menu, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false) // Estado para móvil

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('club_player_id') 
    router.push('/portal')
  }

  const menuItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Socios', href: '/admin/players', icon: Users },
    { name: 'Pagos', href: '/admin/payments', icon: CreditCard },
    { name: 'Cuotas', href: '/admin/fees', icon: FileText },
    { name: 'Bandeja de Entrada', href: '/admin/inbox', icon: Inbox },
  ]

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* BOTÓN HAMBURGUESA (Solo visible en móviles) */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-indigo-900 text-white rounded-lg shadow-lg"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-indigo-900 text-white flex flex-col shadow-xl transition-transform duration-300 transform
        md:relative md:translate-x-0 flex-shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* LOGO Y NOMBRE */}
        <div className="h-24 flex items-center justify-center border-b border-indigo-800 px-4">
            <div className="flex items-center gap-3 w-full">
                <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center border-2 border-orange-500 overflow-hidden shadow-md min-w-[3rem]">
                    <img 
                        src="/logo.png" 
                        alt="Club" 
                        className="h-10 w-10 object-contain" 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </div>
                <div className="flex flex-col justify-center overflow-hidden">
                    <h1 className="font-bold text-sm leading-tight uppercase tracking-tight text-white truncate">
                        Club La Cantera
                    </h1>
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-0.5">
                        Handball
                    </p>
                </div>
            </div>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)} // Cierra el menú al clickear en móvil
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md transform translate-x-1'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 transition-transform group-hover:scale-110 flex-shrink-0 ${isActive ? 'text-orange-400' : ''}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* BOTÓN SALIR */}
        <div className="p-4 border-t border-indigo-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-900/30 hover:text-red-200 rounded-xl transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* OVERLAY PARA MÓVIL (Cierra el menú al tocar fuera) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="w-full h-full p-4 md:p-8">
            {children}
        </div>
      </main>
    </div>
  )
}