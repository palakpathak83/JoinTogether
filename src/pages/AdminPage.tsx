import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ApiError, apiRequest } from '../lib/api.ts';
import type { CategoryMatchWeights, User, UserRole } from '../types/index.ts';

interface AdminOverviewStats {
  totalUsers: number;
  activeUsers: number;
  activeRequests: number;
  openGroups: number;
  fullGroups: number;
  totalMessages: number;
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [weights, setWeights] = useState<CategoryMatchWeights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [ovRes, usrRes, cfgRes] = await Promise.all([
          apiRequest<{ stats: AdminOverviewStats }>('/api/admin/overview'),
          apiRequest<{ users: User[] }>('/api/admin/users'),
          apiRequest<{ matchWeights: CategoryMatchWeights }>('/api/admin/matching-config'),
        ]);
        if (active) {
          setStats(ovRes.stats);
          setUsers(usrRes.users);
          setWeights(cfgRes.matchWeights);
        }
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to load admin data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleRoleChange(userId: string, role: UserRole) {
    setError('');
    try {
      const res = await apiRequest<{ user: User }>(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: { role },
      });
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.user : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update role.');
    }
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    setError('');
    try {
      const res = await apiRequest<{ user: User }>(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: { isActive },
      });
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.user : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update account status.');
    }
  }

  async function handleSaveWeights(e: FormEvent) {
    e.preventDefault();
    if (!weights) return;
    setError('');
    setSavedNotice('');
    try {
      const res = await apiRequest<{ matchWeights: CategoryMatchWeights }>('/api/admin/matching-config', {
        method: 'PUT',
        body: weights,
      });
      setWeights(res.matchWeights);
      setSavedNotice('Matching weights saved to MongoDB.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save matching weights.');
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading admin console...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Admin & RBAC Console
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Server-enforced role management, account moderation, and live matching weights.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {savedNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {savedNotice}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Users</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Active Users</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">{stats.activeUsers}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Active Requests</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">{stats.activeRequests}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Open Groups</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">{stats.openGroups}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Full Groups</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">{stats.fullGroups}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Chat Messages</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">{stats.totalMessages}</p>
          </div>
        </div>
      )}

      {/* User Directory */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">User Directory & Roles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50/60">
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600">{u.city || '—'}</td>
                  <td className="px-6 py-3">
                    {currentUser?.role === 'SUPER_ADMIN' ? (
                      <select
                        aria-label={`Role for ${u.email}`}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value as UserRole)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    ) : (
                      <span className="font-mono text-xs text-slate-700">{u.role}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs">
                    <span className={u.isActive ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {u._id !== currentUser?._id && (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u._id, !u.isActive)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Matching Engine Weights */}
      {weights && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Configurable Matching Score Weights
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Adjust category scoring factor weights directly in MongoDB without redeploying.
          </p>

          <form onSubmit={handleSaveWeights} className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-900">Shopping Weights</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="block">
                  <span className="text-slate-600">Store</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.shopping.storeWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        shopping: { ...weights.shopping, storeWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-600">Zone</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.shopping.zoneWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        shopping: { ...weights.shopping, zoneWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-600">Min Threshold</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.shopping.thresholdWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        shopping: { ...weights.shopping, thresholdWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-600">Split & Discount</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.shopping.discountSplitWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        shopping: { ...weights.shopping, discountSplitWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-900">Hackathon Weights</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="block">
                  <span className="text-slate-600">Event</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.hackathon.eventWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        hackathon: { ...weights.hackathon, eventWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-600">Role Fit</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.hackathon.roleFitWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        hackathon: { ...weights.hackathon, roleFitWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-600">Tech Stack</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.hackathon.stackWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        hackathon: { ...weights.hackathon, stackWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-600">Format & Level</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.hackathon.formatLevelWeight}
                    onChange={(e) =>
                      setWeights({
                        ...weights,
                        hackathon: { ...weights.hackathon, formatLevelWeight: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </label>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                Save Weights Configuration
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
