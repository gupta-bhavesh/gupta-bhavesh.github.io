import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          © {new Date().getFullYear()} Bhavesh Gupta · built with React + Vite
        </p>
        <div className="site-footer__links">
          <a href="https://medium.com/@bhaveshgupta3421" target="_blank" rel="noreferrer">
            medium
          </a>
          <a href="https://github.com/" target="_blank" rel="noreferrer">
            github
          </a>
        </div>
      </div>
    </footer>
  );
}
