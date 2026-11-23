import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { ApiError, apiRequest } from '../lib/api.ts';
import type { Group, MatchCategory } from '../types/index.ts';

export default function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  // Create group state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MatchCategory>('hackathon');
  const [city, setCity] = useState(user?.city || '');
  const [description, setDescription] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(4);
  const [joinMode, setJoinMode] = useState<'approval' | 'instant'>('approval');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (tab === 'mine') params.set('mine', 'true');
        if (categoryFilter !== 'all') params.set('category', categoryFilter);
        if (search.trim()) params.set('q', search.trim());

        const data = await apiRequest<{ groups: Group[] }>(`/api/groups?${params.toString()}`);
        if (active) setGroups(data.groups);
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to load groups.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [tab, categoryFilter, search]);

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await apiRequest<{ group: Group }>('/api/groups', {
        method: 'POST',
        body: {
          name,
          category,
          city,
          description,
          maxCapacity: Number(maxCapacity),
          joinMode,
        },
      });
      navigate(`/app/groups/${res.group._id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create group.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Groups & Squads
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Join capacity-verified groups or spin up a new room for real-time coordination.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{showCreate ? 'Close Form' : 'Create Group'}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">New Group</h2>
          <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Group Name</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ETHGlobal Builders"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MatchCategory)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="shopping">Shopping</option>
                  <option value="travel">Travel</option>
                  <option value="hackathon">Hackathon</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">City</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Seattle"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">Description</label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Goals, split rules, and target dates"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Seat Capacity</label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  required
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Join Policy</label>
                <select
                  value={joinMode}
                  onChange={(e) => setJoinMode(e.target.value as 'approval' | 'instant')}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="approval">Owner Approval</option>
                  <option value="instant">Instant Join</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setTab('discover')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                tab === 'discover' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Discover Open
            </button>
            <button
              type="button"
              onClick={() => setTab('mine')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                tab === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              My Groups
            </button>
          </div>

          <select
            aria-label="Filter groups by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All categories</option>
            <option value="shopping">Shopping</option>
            <option value="travel">Travel</option>
            <option value="hackathon">Hackathon</option>
            <option value="event">Event</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading groups...
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">No groups found</h2>
          <p className="mt-1 text-sm text-slate-600">
            Adjust your filters or create a new group to start coordinating.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((grp) => (
            <article key={grp._id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
              <div>
                <p className="text-xs text-slate-500">
                  <span className="capitalize font-medium text-blue-700">{grp.category}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{grp.city}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{grp.joinMode === 'instant' ? 'Instant join' : 'Approval required'}</span>
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">{grp.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{grp.description}</p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="font-mono text-xs text-slate-600 tabular-nums">
                  {grp.members.length} / {grp.maxCapacity} seats ·{' '}
                  <span className={grp.status === 'open' ? 'text-emerald-700' : 'text-amber-700'}>
                    {grp.status}
                  </span>
                </div>
                <Link
                  to={`/app/groups/${grp._id}`}
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  Open Group
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
