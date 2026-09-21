// Asset-module dashboard.
//
// The landing page for the asset side of the merged system. Shows
// three role-tuned views:
//
//   admin           — system totals across assets, depreciation, reports
//   asset_manager   — asset register + quick actions (register asset,
//                     apply valuation, track lifecycle, set policy)
//   finance_officer — depreciation + reports focus
//
// Data source: three parallel GETs against /api/assets/stats/,
// /api/depreciation/policies/stats/, /api/reports/reports/stats/.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';


function money(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


function StatCard({ label, value, hint, color = 'bg-brand' }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`${color} w-2 self-stretch rounded-full`} />
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
        {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
      </div>
    </div>
  );
}


function ActionTile({ to, title, description }) {
  return (
    <Link to={to} className="card hover:shadow-md transition-shadow block group">
      <div className="text-sm font-semibold text-brand group-hover:text-brand-dark">
        {title}
      </div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </Link>
  );
}


export default function Dashboard() {
  const { role, username } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/assets/stats/').catch(() => ({ data: {} })),
      api.get('/depreciation/policies/stats/').catch(() => ({ data: {} })),
      api.get('/reports/reports/stats/').catch(() => ({ data: {} })),
    ])
      .then(([assetsRes, depRes, reportsRes]) => {
        setStats({
          assets: assetsRes.data || {},
          depreciation: depRes.data || {},
          reports: reportsRes.data || {},
        });
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load dashboard.');
      });
  }, []);

  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
        {error}
      </div>
    );
  }

  if (!stats) {
    return <div className="text-slate-500">Loading dashboard…</div>;
  }

  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back{username ? `, ${username}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin
            ? 'System overview — assets, depreciation, and reports at a glance.'
            : role === 'asset_manager'
              ? 'Register assets, run valuations, track lifecycle events, and set depreciation policies.'
              : role === 'finance_officer'
                ? 'Generate depreciation schedules and produce financial reports.'
                : 'Headline numbers across the asset register.'}
        </p>
      </div>

      {isAdmin && <AdminOverview stats={stats} />}
      {role === 'asset_manager' && <AssetManagerDashboard stats={stats} />}
      {role === 'finance_officer' && <FinanceOfficerDashboard stats={stats} />}
      {!isAdmin && role !== 'asset_manager' && role !== 'finance_officer' && (
        <GenericDashboard stats={stats} />
      )}
    </div>
  );
}


function AdminOverview({ stats }) {
  return (
    <>
      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionTile to="/admin/users" title="Manage users" description="Add, edit, or reset users." />
          <ActionTile to="/assets" title="Assets" description="Browse the asset register." />
          <ActionTile to="/depreciation" title="Depreciation" description="Policies and schedules." />
          <ActionTile to="/asset-reports" title="Reports" description="Generate financial reports." />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          System totals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Assets" value={stats.assets.total_assets ?? 0} color="bg-brand" />
          <StatCard label="Active assets" value={stats.assets.active_assets ?? 0} color="bg-emerald-500" />
          <StatCard label="Depreciation policies" value={stats.depreciation.total_policies ?? 0} color="bg-amber-500" />
          <StatCard label="Reports generated" value={stats.reports.generated_reports ?? 0} color="bg-indigo-500" />
        </div>
      </section>
    </>
  );
}


function AssetManagerDashboard({ stats }) {
  return (
    <>
      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionTile to="/assets/new" title="+ Register asset" description="Add a new asset to the register." />
          <ActionTile to="/assets" title="Apply valuation method" description="Open an asset and record a fresh valuation." />
          <ActionTile to="/assets" title="Track lifecycle event" description="Log maintenance, transfer, impairment, disposal." />
          <ActionTile to="/depreciation/new" title="Set depreciation policy" description="Configure a policy and method for an asset." />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Asset register
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total assets" value={stats.assets.total_assets ?? 0} color="bg-brand" />
          <StatCard label="Active" value={stats.assets.active_assets ?? 0} color="bg-emerald-500" />
          <StatCard label="Disposed" value={stats.assets.disposed_assets ?? 0} color="bg-slate-400" />
          <StatCard
            label="Total acquisition value"
            value={money(stats.assets.total_acquisition_value)}
            hint="Sum of purchase costs"
            color="bg-amber-500"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Depreciation policies
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total policies" value={stats.depreciation.total_policies ?? 0} color="bg-brand" />
          <StatCard label="Active" value={stats.depreciation.active_policies ?? 0} color="bg-emerald-500" />
          <StatCard label="Closed" value={stats.depreciation.closed_policies ?? 0} color="bg-slate-400" />
        </div>
      </section>
    </>
  );
}


function FinanceOfficerDashboard({ stats }) {
  return (
    <>
      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionTile to="/asset-reports/new" title="Generate financial report" description="Build a new report from current data." />
          <ActionTile to="/asset-reports" title="Export report" description="Open a report and export to PDF or CSV." />
          <ActionTile to="/reports" title="Cross-module reports" description="Lease · Revenue · Budget · Asset roll-ups." />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Reports
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total reports" value={stats.reports.total_reports ?? 0} color="bg-brand" />
          <StatCard label="Generated" value={stats.reports.generated_reports ?? 0} color="bg-emerald-500" />
          <StatCard label="Finalised" value={stats.reports.finalized_reports ?? 0} color="bg-amber-500" />
        </div>
      </section>
    </>
  );
}


function GenericDashboard({ stats }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        System snapshot
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assets" value={stats.assets.total_assets ?? 0} />
        <StatCard label="Depreciation policies" value={stats.depreciation.total_policies ?? 0} />
        <StatCard label="Reports" value={stats.reports.total_reports ?? 0} />
      </div>
    </section>
  );
}
