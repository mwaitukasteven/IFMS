import { Link, Navigate } from 'react-router-dom';
import { useAuth, roleHome } from '../context/AuthContext';

export default function LandingPage() {
  const { isAuthenticated, role } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={roleHome(role) || '/dashboard'} replace />;
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-brand">
          <span className="brand-icon">◈</span>
          <div>
            <h1>FINANCIAL MANAGEMENT SYSTEM</h1>
            <p>Integrated Asset, Lease & Budget Platform</p>
          </div>
        </div>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-glow">Sign In</Link>
        </div>
      </header>

      <section className="landing-hero landing-hero-single">
        <div className="hero-content">
          <span className="hero-badge">Enterprise Financial Platform</span>
          <h2>Manage assets, leases, tenants & budgets in one unified system</h2>
          <p>
            A collaborative platform connecting Asset Managers, Lease Officers, Finance Officers,
            and Tenants with integrated reporting for comprehensive financial oversight.
          </p>
          <Link to="/login" className="btn btn-large btn-glow">Get Started →</Link>
        </div>
      </section>

   

      <footer className="landing-footer">
        <p>Financial Management System · Asset · Lease · Budget · Reports</p>
      </footer>
    </div>
  );
}
