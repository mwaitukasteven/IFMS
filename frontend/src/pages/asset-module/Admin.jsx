// Admin — hub page for the administrator.
//
// The sidebar for an administrator deliberately only lists Dashboard
// and Users (the two surfaces an admin lives in day-to-day). The
// remaining modules (Assets, Depreciation, Reports, Integration) are
// reachable from here via grouped cards so the admin still has a
// single screen from which to reach any part of the system.

import { Link } from 'react-router-dom';


// Card config — kept in module scope so the JSX below stays a flat
// .map() and the visible list of admin sections is easy to scan in
// one place.
const SECTIONS = [
  {
    to: '/assets',
    title: 'Assets',
    description: 'Browse the asset register, valuations, and lifecycle events.',
  },
  {
    to: '/depreciation',
    title: 'Depreciation',
    description: 'Review depreciation policies and generated schedules.',
  },
  {
    to: '/reports',
    title: 'Reports',
    description: 'Open financial reports and exports.',
  },
  {
    to: '/integration',
    title: 'Integration',
    description: 'Manage external API clients and view integration logs.',
  },
];


function SectionCard({ to, title, description }) {
  return (
    <Link
      to={to}
      className="card hover:shadow-md transition-shadow block group"
    >
      <div className="text-sm font-semibold text-brand group-hover:text-brand-dark">
        {title}
      </div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </Link>
  );
}


export default function Admin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500 mt-1">
          Jump into any module. Day-to-day user management lives under
          Users in the sidebar.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SECTIONS.map((s) => (
            <SectionCard key={s.to} {...s} />
          ))}
        </div>
      </section>
    </div>
  );
}
