import { useEffect, useState, type FormEvent } from 'react';
import { Sparkles, Trash2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { ApiError, apiRequest } from '../lib/api.ts';
import type { MatchCategory, MatchRequest } from '../types/index.ts';

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [category, setCategory] = useState<MatchCategory>('shopping');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState(user?.city || '');
  const [maxGroupSize, setMaxGroupSize] = useState(4);

  // Shopping fields
  const [storeName, setStoreName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState(150);
  const [userSpendAmount, setUserSpendAmount] = useState(65);
  const [targetDiscountPct, setTargetDiscountPct] = useState(15);
  const [deliveryZone, setDeliveryZone] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'proportional'>('proportional');

  // Travel fields
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('2026-12-05');
  const [budgetMax, setBudgetMax] = useState(300);
  const [transportMode, setTransportMode] = useState<'carpool' | 'train' | 'flight' | 'van'>('carpool');
  const [pace, setPace] = useState<'relaxed' | 'moderate' | 'packed'>('moderate');

  // Hackathon fields
  const [eventName, setEventName] = useState('');
  const [hackathonFormat, setHackathonFormat] = useState<'online' | 'in-person' | 'hybrid'>('hybrid');
  const [offeredRole, setOfferedRole] = useState('Backend');
  const [neededRolesText, setNeededRolesText] = useState('Frontend, Designer');
  const [techStackText, setTechStackText] = useState('TypeScript, React, MongoDB');
  const [experienceLevel, setExperienceLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');

  // Event fields
  const [eventTitle, setEventTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('2026-12-12');
  const [ticketTier, setTicketTier] = useState<'standard' | 'vip' | 'group-pass'>('group-pass');
  const [maxBudget, setMaxBudget] = useState(120);
  const [vibe, setVibe] = useState<'networking' | 'casual' | 'focused'>('networking');

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await apiRequest<{ requests: MatchRequest[] }>('/api/requests?mine=true');
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    let details: Record<string, unknown>;
    if (category === 'shopping') {
      details = {
        storeName,
        productCategory,
        targetDiscountPct: Number(targetDiscountPct),
        minOrderAmount: Number(minOrderAmount),
        userSpendAmount: Number(userSpendAmount),
        deliveryZone: deliveryZone || city,
        splitType,
      };
    } else if (category === 'travel') {
      details = {
        origin: origin || city,
        destination,
        departureDate,
        budgetMax: Number(budgetMax),
        transportMode,
        pace,
      };
    } else if (category === 'hackathon') {
      details = {
        eventName,
        hackathonFormat,
        offeredRole,
        neededRoles: neededRolesText.split(',').map((s) => s.trim()).filter(Boolean),
        techStack: techStackText.split(',').map((s) => s.trim()).filter(Boolean),
        experienceLevel,
      };
    } else {
      details = {
        eventTitle,
        venue,
        eventDate,
        ticketTier,
        maxBudget: Number(maxBudget),
        vibe,
      };
    }

    try {
      const res = await apiRequest<{ request: MatchRequest }>('/api/requests', {
        method: 'POST',
        body: {
          category,
          title,
          description,
          city,
          maxGroupSize: Number(maxGroupSize),
          details,
        },
      });
      setRequests((prev) => [res.request, ...prev]);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create match request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      const res = await apiRequest<{ request: MatchRequest }>(`/api/requests/${id}`, {
        method: 'PATCH',
        body: { status: 'cancelled' },
      });
      setRequests((prev) => prev.map((r) => (r._id === id ? res.request : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel request.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiRequest(`/api/requests/${id}`, { method: 'DELETE' });
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete request.');
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Match Requests
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Publish structured criteria in any category to run compatibility matching against active peers.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Request Builder */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-semibold text-slate-900">Create New Request</h2>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Request category">
            {(['shopping', 'travel', 'hackathon', 'event'] as MatchCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={category === cat}
                onClick={() => setCategory(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  category === cat ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCreate} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="req-title" className="block text-xs font-medium text-slate-700">
                Request Title
              </label>
              <input
                id="req-title"
                type="text"
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === 'shopping'
                    ? 'Costco organic pantry split'
                    : category === 'travel'
                      ? 'Weekend carpool to Lake Tahoe'
                      : category === 'hackathon'
                        ? 'Need Frontend & Designer for Climate Hack'
                        : 'Group pass for Design Systems Conf'
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="req-city" className="block text-xs font-medium text-slate-700">
                City
              </label>
              <input
                id="req-city"
                type="text"
                required
                minLength={2}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="San Francisco"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-3">
              <label htmlFor="req-desc" className="block text-xs font-medium text-slate-700">
                Description & Logistics
              </label>
              <input
                id="req-desc"
                type="text"
                required
                minLength={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share pickup window, budget constraints, or collaboration expectations"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="req-size" className="block text-xs font-medium text-slate-700">
                Max Group Size
              </label>
              <input
                id="req-size"
                type="number"
                min={2}
                max={20}
                required
                value={maxGroupSize}
                onChange={(e) => setMaxGroupSize(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-sm tabular-nums focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Category-Specific Fields */}
          {category === 'shopping' && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Store Name</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Costco"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Product Category</label>
                <input
                  type="text"
                  required
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  placeholder="Groceries & Pantry"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Delivery Zone</label>
                <input
                  type="text"
                  required
                  value={deliveryZone}
                  onChange={(e) => setDeliveryZone(e.target.value)}
                  placeholder="Downtown"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Min Order ($)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Your Spend ($)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={userSpendAmount}
                  onChange={(e) => setUserSpendAmount(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Split Type & Target %</label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    value={splitType}
                    onChange={(e) => setSplitType(e.target.value as 'equal' | 'proportional')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
                  >
                    <option value="proportional">Proportional</option>
                    <option value="equal">Equal</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={95}
                    value={targetDiscountPct}
                    onChange={(e) => setTargetDiscountPct(Number(e.target.value))}
                    aria-label="Target discount percentage"
                    className="w-20 rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {category === 'travel' && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Origin Hub</label>
                <input
                  type="text"
                  required
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="San Francisco"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Destination</label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Lake Tahoe"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Departure Date</label>
                <input
                  type="date"
                  required
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Max Budget ($)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Transport Mode</label>
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value as 'carpool' | 'train' | 'flight' | 'van')}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="carpool">Carpool</option>
                  <option value="van">Shared Van</option>
                  <option value="train">Train</option>
                  <option value="flight">Flight</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Itinerary Pace</label>
                <select
                  value={pace}
                  onChange={(e) => setPace(e.target.value as 'relaxed' | 'moderate' | 'packed')}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="relaxed">Relaxed</option>
                  <option value="moderate">Moderate</option>
                  <option value="packed">Packed</option>
                </select>
              </div>
            </div>
          )}

          {category === 'hackathon' && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Hackathon Event</label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Climate Hack 2026"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Your Offered Role</label>
                <input
                  type="text"
                  required
                  value={offeredRole}
                  onChange={(e) => setOfferedRole(e.target.value)}
                  placeholder="Backend"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Needed Roles (comma-separated)</label>
                <input
                  type="text"
                  required
                  value={neededRolesText}
                  onChange={(e) => setNeededRolesText(e.target.value)}
                  placeholder="Frontend, Designer"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Tech Stack (comma-separated)</label>
                <input
                  type="text"
                  required
                  value={techStackText}
                  onChange={(e) => setTechStackText(e.target.value)}
                  placeholder="TypeScript, React, MongoDB"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Format</label>
                <select
                  value={hackathonFormat}
                  onChange={(e) => setHackathonFormat(e.target.value as 'online' | 'in-person' | 'hybrid')}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="hybrid">Hybrid</option>
                  <option value="in-person">In-Person</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
          )}

          {category === 'event' && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Event Title</label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Design Systems Conf"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Venue</label>
                <input
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Moscone West"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Event Date</label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Ticket Tier</label>
                <select
                  value={ticketTier}
                  onChange={(e) => setTicketTier(e.target.value as 'standard' | 'vip' | 'group-pass')}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="group-pass">Group Pass</option>
                  <option value="standard">Standard</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Max Budget ($)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Attendance Style</label>
                <select
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value as 'networking' | 'casual' | 'focused')}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="networking">Networking</option>
                  <option value="casual">Casual</option>
                  <option value="focused">Focused</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Publishing...' : 'Publish Match Request'}
            </button>
          </div>
        </form>
      </section>

      {/* Request List */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">Your Published Requests</h2>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading your requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No requests created yet. Use the builder above to post one.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r._id} className="flex flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium capitalize text-blue-700">{r.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{r.city}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Max {r.maxGroupSize}</span>
                    <span aria-hidden="true">·</span>
                    <span className={r.status === 'active' ? 'font-medium text-emerald-700' : 'text-slate-500'}>
                      {r.status}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{r.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-600">{r.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'active' && (
                    <Link
                      to={`/app/matches?requestId=${r._id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Find Matches</span>
                    </Link>
                  )}
                  {r.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(r._id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(r._id)}
                    aria-label={`Delete ${r.title}`}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
