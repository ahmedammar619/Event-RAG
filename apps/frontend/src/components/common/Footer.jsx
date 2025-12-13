export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p>
          © {currentYear} MASCOM.{' '}
          <a href="https://ahmedammar.dev?mascom" target="_blank" rel="noopener noreferrer">
            Developer
          </a>
        </p>
      </div>

      <style>{`
        .app-footer {
          background: #1e293b;
          color: #94a3b8;
          padding: 1.5rem;
          text-align: center;
          margin-top: auto;
        }

        .footer-content p {
          margin: 0;
          font-size: 0.875rem;
        }

        .app-footer a {
          color: #60a5fa;
          text-decoration: none;
          font-weight: 500;
        }

        .app-footer a:hover {
          text-decoration: underline;
        }
      `}</style>
    </footer>
  )
}
