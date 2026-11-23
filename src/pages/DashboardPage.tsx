import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ClipboardList, ShieldAlert, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { ApiError, apiRequest } from '../lib/api.ts';
import type { Group, MatchRequest, User } from '../types/index.ts';

export default function DashboardPage() {
  const { user, setUserDirect } = useAuth();
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimStatus, setClaimStatus] = useState<{ claimed: boolean; requiresPasscode: boolean } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [reqRes, grpRes, bootRes] = await Promise.all([
          apiRequest<{ requests: MatchRequest[] }>('/api/requests?mine=true'),
          apiRequest<{ groups: Group[] }>('/api/groups?mine=true'),
          apiRequest<{ claimed: boolean; requiresPasscode: boolean }>('/api/auth/admin-bootstrap/status', {
            skipAuth: true,
          }),
        ]);
        if (active) {
          setRequests(reqRes.requests);
          setGroups(grpRes.groups);
          setClaimStatus(bootRes);
        }
      } catch {
        // Ignore initial errors
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleClaimSuperAdmin(e: FormEvent) {
    e.preventDefault();
    setClaimError('');
    setClaiming(true);
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/admin-bootstrap/claim', {
        method: 'POST',
        body: { passcode },
      });
      setUserDirect(res.user);
      setClaimStatus({ claimed: true, requiresPasscode: false });
    } catch (err) {
      setClaimError(err instanceof ApiError ? err.message : 'Unable to claim Super Admin role.');
    } finally {
      setClaiming(false);
    }
  }

  const activeRequestCount = requests.filter((r) => r.status === 'active').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage active match requests, inspect compatibility scores, and coordinate inside your groups.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/app/matches"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-700" />
            <span>Run Matcher</span>
          </Link>
          <Link
            to="/app/requests"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <span>Post Request</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* First-run Super Admin Bootstrap Claim when unclaimed */}
      {claimStatus && !claimStatus.claimed && user?.role === 'USER' && (
        <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-blue-700 shrink-0" />
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Initial Super Admin Setup Available
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  No Super Admin account exists in this deployment yet. You can claim the one-time Super Admin role for your account to unlock RBAC user management and matching weight controls.
                </p>
              </div>
            </div>
            <form onSubmit={handleClaimSuperAdmin} className="flex flex-wrap items-center gap-2 shrink-0">
              {claimStatus.requiresPasscode && (
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Admin bootstrap passcode"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              )}
              <button
                type="submit"
                disabled={claiming}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {claiming ? 'Claiming...' : 'Claim Super Admin'}
              </button>
            </form>
          </div>
          {claimError && <p className="mt-2 text-xs font-medium text-red-700">{claimError}</p>}
        </section>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Active Match Requests</span>
            <ClipboardList className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : activeRequestCount}
          </p>
          <Link to="/app/requests" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
            Manage requests
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Joined Groups</span>
            <Users className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : groups.length}
          </p>
          <Link to="/app/groups" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
            Browse all groups
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Account Access Role</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-slate-900">{user?.role}</p>
          <Link to="/app/profile" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
            Update profile & skills
          </Link>
        </div>
      </div>

      {/* Recent Requests & Groups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">Your Recent Requests</h2>
            <Link to="/app/requests" className="text-xs font-medium text-blue-700 hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No requests posted yet.{' '}
              <Link to="/app/requests" className="font-medium text-blue-700 hover:underline">
                Create your first request
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.slice(0, 4).map((req) => (
                <li key={req._id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{req.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {req.category} · {req.city} · {req.status}
                    </p>
                  </div>
                  <Link
                    to={`/app/matches?requestId=${req._id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    Matches
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">Your Active Groups</h2>
            <Link to="/app/groups" className="text-xs font-medium text-blue-700 hover:underline">
              Browse groups
            </Link>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              You have not joined any groups yet.{' '}
              <Link to="/app/groups" className="font-medium text-blue-700 hover:underline">
                Explore open groups
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.slice(0, 4).map((grp) => (
                <li key={grp._id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{grp.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                      {grp.category} · {grp.members.length}/{grp.maxCapacity} seats · {grp.status}
                    </p>
                  </div>
                  <Link
                    to={`/app/groups/${grp._id}`}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    Open Chat
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
