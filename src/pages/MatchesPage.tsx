import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../lib/api.ts';
import type { Group, MatchRequest, PaginatedMatchResult } from '../types/index.ts';

export default function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [myRequests, setMyRequests] = useState<MatchRequest[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('requestId') || '');
  const [result, setResult] = useState<PaginatedMatchResult | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await apiRequest<{ requests: MatchRequest[] }>('/api/requests?mine=true');
        const activeOnly = res.requests.filter((r) => r.status === 'active');
        if (active) {
          setMyRequests(activeOnly);
          if (!selectedId && activeOnly.length > 0) {
            setSelectedId(activeOnly[0]._id);
          }
        }
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to load requests.');
      } finally {
        if (active) setLoadingRequests(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setResult(null);
      return;
    }

    let active = true;
    async function fetchMatches() {
      setLoadingMatches(true);
      setError('');
      try {
        const data = await apiRequest<PaginatedMatchResult>(
          `/api/matches/for-request/${selectedId}?page=${page}&limit=8`
        );
        if (active) setResult(data);
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to compute matches.');
      } finally {
        if (active) setLoadingMatches(false);
      }
    }

    fetchMatches();
    return () => {
      active = false;
    };
  }, [selectedId, page]);

  function handleSelectRequest(id: string) {
    setSelectedId(id);
    setPage(1);
    setSearchParams({ requestId: id });
  }

  async function handleConnect(targetRequestId: string) {
    if (!selectedId) return;
    setConnectingId(targetRequestId);
    setError('');
    setFeedback('');
    try {
      const res = await apiRequest<{ action: 'group_created' | 'join_requested'; group: Group }>(
        '/api/matches/connect',
        {
          method: 'POST',
          body: {
            sourceRequestId: selectedId,
            targetRequestId,
          },
        }
      );

      if (res.action === 'group_created') {
        navigate(`/app/groups/${res.group._id}`);
      } else {
        setFeedback(`Join request sent to "${res.group.name}". You will receive an alert when approved.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to connect with match.');
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Compatibility Matches
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ranked active peers matching your hard constraints and category weights.
          </p>
        </div>

        <div className="w-full sm:w-80">
          <label htmlFor="match-source-select" className="block text-xs font-medium text-slate-600">
            Matching for active request
          </label>
          <select
            id="match-source-select"
            value={selectedId}
            onChange={(e) => handleSelectRequest(e.target.value)}
            disabled={loadingRequests || myRequests.length === 0}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
          >
            {myRequests.length === 0 ? (
              <option value="">No active requests</option>
            ) : (
              myRequests.map((r) => (
                <option key={r._id} value={r._id}>
                  [{r.category}] {r.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {feedback}
        </div>
      )}

      {!loadingRequests && myRequests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            Create an active request to find matches
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Publish criteria for shopping, travel, a hackathon, or an event first.
          </p>
          <Link
            to="/app/requests"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            <span>Go to My Requests</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : loadingMatches ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Evaluating active requests in MongoDB...
        </div>
      ) : result && result.matches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="font-display text-base font-semibold text-slate-900">
            No compatible matches found yet
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Try widening your city/budget parameters or create an open group directly in Groups so peers can discover you.
          </p>
          <Link
            to="/app/groups"
            className="mt-4 inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Browse or Create Group
          </Link>
        </div>
      ) : result ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            Showing {result.matches.length} of {result.total} compatible matches · Page {result.page} of {Math.max(1, result.totalPages)}
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {result.matches.map((match) => (
              <article key={match.requestId} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        <span className="capitalize">{match.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{match.city}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{match.creator.name}</span>
                      </p>
                      <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
                        {match.title}
                      </h2>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xl font-bold text-blue-700 tabular-nums">
                        {match.score}
                      </span>
                      <span className="font-mono text-xs text-slate-400"> / 100</span>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">{match.description}</p>

                  <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                    {match.reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    Group limit: {match.maxGroupSize}
                  </span>
                  <button
                    type="button"
                    disabled={connectingId === match.requestId}
                    onClick={() => handleConnect(match.requestId)}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                  >
                    {connectingId === match.requestId
                      ? 'Connecting...'
                      : match.matchedGroupId
                        ? 'Request to Join Group'
                        : 'Form Group & Invite'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!result.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
