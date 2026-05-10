import { NavLink, Link } from 'react-router-dom';
import './Header.css';

const links = [
  { to: '/blog', label: 'Blog' },
  { to: '/visuals', label: 'Visuals' },
  { to: '/about', label: 'About' },
];

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand">
          <span className="site-header__brand-mark">b.</span>
          <span className="site-header__brand-name">bhavesh gupta</span>
        </Link>
        <nav className="site-header__nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `site-header__link${isActive ? ' is-active' : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
