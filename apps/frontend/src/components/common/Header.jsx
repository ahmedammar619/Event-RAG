import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="w-full py-4 px-6 flex items-center justify-center gap-3 bg-white border-b border-slate-200 shadow-sm">
      <Link to="/" className="flex items-center gap-3 no-underline">
        <img src="/logo.png?3" alt="Vewoz" className="w-24 h-24 object-contain" />
        <span className="vewoz-logo text-5xl">Vewoz</span>
      </Link>
    </header>
  )
}
