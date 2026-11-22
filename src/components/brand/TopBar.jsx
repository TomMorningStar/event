import { Link } from 'react-router-dom'
import logoUrl from '../../assets/brand/logo-horizontal.svg'

/** Верхняя полоса публичных страниц: логотип слева, произвольный блок справа. */
export default function TopBar({ children }) {
  return (
    <header className="vd-top">
      <Link to="/" className="vd-logo-link" aria-label="ВКУСДОМ — на страницу розыгрыша">
        <img className="vd-logo" src={logoUrl} alt="ВКУСДОМ — гипермаркет" />
      </Link>
      {children}
    </header>
  )
}
