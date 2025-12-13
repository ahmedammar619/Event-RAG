import { Link } from 'react-router-dom'

export default function Landing() {
  const currentYear = new Date().getFullYear()

  return (
    <div className="landing">
      <div className="landing-content">
        <h1>MASCOM 2025</h1>
        <h2>Moderation System</h2>
        <p>
          Help us coordinate volunteer moderators for the annual MASCOM event in Chicago.
          Register as a volunteer and input your availability.
        </p>

        <div className="landing-actions">
          <Link to="/register" className="btn btn-primary btn-lg">
            Register as Volunteer
          </Link>
          <Link to="/admin/login" className="btn btn-outline btn-lg">
            Admin Login
          </Link>
        </div>

        <div className="landing-info">
          <div className="info-card">
            <h3>1. Register</h3>
            <p>Enter your name, email, and phone number</p>
          </div>
          <div className="info-card">
            <h3>2. Set Availability</h3>
            <p>Select when you can volunteer each day</p>
          </div>
          <div className="info-card">
            <h3>3. Get Assigned</h3>
            <p>We'll assign you to sessions automatically</p>
          </div>
        </div>
      </div>

      <footer className="landing-footer">
        © {currentYear} MASCOM. Developed by{' '}
        <a href="https://ahmedammar.dev" target="_blank" rel="noopener noreferrer">
          Ahmed Ammar
        </a>
      </footer>

      <style>{`
        .landing {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
        }

        .landing-footer {
          position: absolute;
          bottom: 1rem;
          left: 0;
          right: 0;
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.875rem;
        }

        .landing-footer a {
          color: rgba(255, 255, 255, 0.9);
          text-decoration: none;
        }

        .landing-footer a:hover {
          text-decoration: underline;
        }

        .landing-content {
          text-align: center;
          max-width: 800px;
        }

        .landing h1 {
          font-size: 3rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
        }

        .landing h2 {
          font-size: 1.5rem;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 1.5rem;
        }

        .landing > .landing-content > p {
          font-size: 1.125rem;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .landing-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 3rem;
        }

        .landing-actions .btn-outline {
          border-color: rgba(255, 255, 255, 0.3);
          color: white;
        }

        .landing-actions .btn-outline:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .landing-info {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .info-card {
          background: rgba(255, 255, 255, 0.1);
          border-radius: var(--radius);
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .info-card h3 {
          color: white;
          font-size: 1.125rem;
          margin-bottom: 0.5rem;
        }

        .info-card p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .landing h1 {
            font-size: 2rem;
          }

          .landing-actions {
            flex-direction: column;
          }

          .landing-info {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
