import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, CheckCheck, LogOut, Send, Users, X, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.tsx';
import { API_BASE, ApiError, apiRequest } from '../lib/api.ts';
import type { ChatMessage, Group, GroupMember } from '../types/index.ts';

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, accessToken } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const ownerId =
    group && typeof group.ownerId === 'object' ? group.ownerId._id : (group?.ownerId as string | undefined);
  const isOwner = Boolean(user && ownerId && user._id === ownerId);
  const isMember = Boolean(
    user &&
      group?.members.some((m) => (typeof m === 'string' ? m === user._id : m._id === user._id))
  );

  const loadGroupAndMessages = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError('');
    try {
      const grpRes = await apiRequest<{ group: Group }>(`/api/groups/${groupId}`);
      setGroup(grpRes.group);

      const memberNow = Boolean(
        user &&
          grpRes.group.members.some((m) => (typeof m === 'string' ? m === user._id : m._id === user._id))
      );

      if (memberNow) {
        const msgRes = await apiRequest<{ messages: ChatMessage[] }>(`/api/groups/${groupId}/messages`);
        setMessages(msgRes.messages);
        await apiRequest(`/api/groups/${groupId}/messages/read`, { method: 'POST' });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load group.');
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  useEffect(() => {
    loadGroupAndMessages();
  }, [loadGroupAndMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Authenticated Socket.IO connection for members
  useEffect(() => {
    if (!groupId || !accessToken || !isMember) return;

    const socketUrl = API_BASE || window.location.origin;
    const socket = io(socketUrl, {
      auth: { token: accessToken },
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('group:join', groupId, (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          socket.emit('message:read', { groupId });
        }
      });
    });

    socket.on('message:new', (msg: ChatMessage) => {
      if (msg.groupId !== groupId) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      socket.emit('message:read', { groupId });
    });

    socket.on(
      'messages:read',
      (evt: { groupId: string; userId: string; readAt: string }) => {
        if (evt.groupId !== groupId) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.readBy.some((r) => r.userId === evt.userId)) return m;
            return { ...m, readBy: [...m.readBy, { userId: evt.userId, readAt: evt.readAt }] };
          })
        );
      }
    );

    socket.on('typing:update', (evt: { groupId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (evt.groupId !== groupId || evt.userId === user?._id) return;
      setTypingUser(evt.isTyping ? evt.userName : null);
    });

    return () => {
      socket.emit('group:leave', groupId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId, accessToken, isMember, user?._id]);

  async function handleRequestJoin(e: FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setActionBusy(true);
    setError('');
    try {
      await apiRequest(`/api/groups/${groupId}/join-requests`, {
        method: 'POST',
        body: { message: joinMsg },
      });
      setJoinMsg('');
      await loadGroupAndMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to send join request.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleInstantJoin() {
    if (!groupId) return;
    setActionBusy(true);
    setError('');
    try {
      await apiRequest(`/api/groups/${groupId}/join-instant`, { method: 'POST' });
      await loadGroupAndMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to join group.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReviewJoin(reqId: string, action: 'accept' | 'reject') {
    if (!groupId) return;
    setError('');
    try {
      await apiRequest(`/api/groups/${groupId}/join-requests/${reqId}/${action}`, { method: 'POST' });
      await loadGroupAndMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Unable to ${action} request.`);
    }
  }

  async function handleLeave() {
    if (!groupId) return;
    setActionBusy(true);
    setError('');
    try {
      await apiRequest(`/api/groups/${groupId}/leave`, { method: 'POST' });
      await loadGroupAndMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to leave group.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCloseGroup() {
    if (!groupId) return;
    setActionBusy(true);
    setError('');
    try {
      await apiRequest(`/api/groups/${groupId}/cancel`, { method: 'POST' });
      await loadGroupAndMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to close group.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !groupId) return;

    setChatInput('');
    socketRef.current?.emit('typing:stop', groupId);

    if (socketRef.current?.connected) {
      socketRef.current.emit(
        'message:send',
        { groupId, content: trimmed },
        (ack: { ok: boolean; error?: string; message?: ChatMessage }) => {
          if (!ack?.ok) {
            setError(ack?.error || 'Failed to deliver message.');
          } else if (ack.message) {
            setMessages((prev) => (prev.some((m) => m._id === ack.message!._id) ? prev : [...prev, ack.message!]));
          }
        }
      );
    } else {
      try {
        const res = await apiRequest<{ message: ChatMessage }>(`/api/groups/${groupId}/messages`, {
          method: 'POST',
          body: { content: trimmed },
        });
        setMessages((prev) => (prev.some((m) => m._id === res.message._id) ? prev : [...prev, res.message]));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to send message.');
      }
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading group room...</div>;
  }

  if (!group) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <p className="text-sm text-red-700">{error || 'Group not found.'}</p>
        <Link to="/app/groups" className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:underline">
          Back to Groups
        </Link>
      </div>
    );
  }

  const pendingRequests = (group.joinRequests || []).filter((jr) => jr.status === 'pending');
  const myPending = pendingRequests.some((jr) => {
    const uid = typeof jr.userId === 'object' ? jr.userId._id : jr.userId;
    return uid === user?._id;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs text-slate-500">
            <Link to="/app/groups" className="hover:underline">Groups</Link>
            <span aria-hidden="true"> · </span>
            <span className="capitalize">{group.category}</span>
            <span aria-hidden="true"> · </span>
            <span>{group.city}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">{group.members.length}/{group.maxCapacity} seats</span>
            <span aria-hidden="true"> · </span>
            <span className={group.status === 'open' ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>
              {group.status}
            </span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            {group.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{group.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isMember && !isOwner && group.status !== 'closed' && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Leave Group</span>
            </button>
          )}
          {isOwner && group.status !== 'closed' && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleCloseGroup}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Close Group</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sidebar: Members & Join Requests */}
        <div className="space-y-6 lg:col-span-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-sm font-semibold text-slate-900">Members</h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {group.members.length}/{group.maxCapacity}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {group.members.map((m) => {
                const memberObj: GroupMember =
                  typeof m === 'string' ? { _id: m, name: 'Member', city: '' } : m;
                const memberIsOwner = memberObj._id === ownerId;
                return (
                  <li key={memberObj._id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{memberObj.name}</p>
                      {memberObj.city && <p className="text-xs text-slate-500">{memberObj.city}</p>}
                    </div>
                    {memberIsOwner && (
                      <span className="text-xs font-medium text-blue-700">Owner</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Join Action for Non-Members */}
          {!isMember && group.status === 'open' && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-sm font-semibold text-slate-900">Join This Group</h2>
              {myPending ? (
                <p className="mt-2 text-xs text-amber-800">
                  Your join request is pending review by the group owner.
                </p>
              ) : group.joinMode === 'instant' ? (
                <div className="mt-3">
                  <p className="text-xs text-slate-600">
                    Open instant-join group. Seat availability is verified atomically.
                  </p>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleInstantJoin}
                    className="mt-3 w-full rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                  >
                    {actionBusy ? 'Joining...' : 'Join Group Instantly'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestJoin} className="mt-3 space-y-3">
                  <textarea
                    rows={2}
                    value={joinMsg}
                    onChange={(e) => setJoinMsg(e.target.value)}
                    placeholder="Introduce yourself or share how you fit the group..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-700 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="w-full rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                  >
                    {actionBusy ? 'Sending...' : 'Send Join Request'}
                  </button>
                </form>
              )}
            </section>
          )}

          {/* Owner Approval Queue */}
          {isOwner && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Pending Join Requests ({pendingRequests.length})
              </h2>
              {pendingRequests.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No pending requests.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {pendingRequests.map((jr) => {
                    const reqUser =
                      typeof jr.userId === 'object' ? jr.userId : { _id: jr.userId, name: 'Applicant', city: '' };
                    return (
                      <li key={jr._id} className="py-3">
                        <p className="text-xs font-semibold text-slate-900">
                          {reqUser.name} {reqUser.city ? `· ${reqUser.city}` : ''}
                        </p>
                        {jr.message && <p className="mt-1 text-xs text-slate-600">{jr.message}</p>}
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReviewJoin(jr._id, 'accept')}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewJoin(jr._id, 'reject')}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Right Panel: Authenticated Real-Time Group Chat */}
        <section className="flex h-[540px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">Group Chat Room</h2>
              <p className="text-xs text-slate-500">
                {isMember
                  ? 'Authenticated Socket.IO room with persistent history and read receipts'
                  : 'Membership required to read or send group messages'}
              </p>
            </div>
            <Users className="h-4 w-4 text-slate-400" />
          </div>

          {!isMember ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-slate-800">Private Member Conversation</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Join this group to access persistent messages and live coordination updates.
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-6">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500">
                    No messages yet. Start the coordination thread below.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderId === user?._id;
                    const seenCount = Math.max(0, (msg.readBy?.length || 1) - 1);
                    return (
                      <div
                        key={msg._id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm ${
                            isSelf
                              ? 'bg-blue-700 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-900'
                          }`}
                        >
                          {!isSelf && (
                            <p className="mb-0.5 text-xs font-semibold text-slate-700">
                              {msg.senderName}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isSelf && (
                            <span className="inline-flex items-center gap-0.5">
                              <CheckCheck className="h-3 w-3" />
                              <span>{seenCount > 0 ? `Seen by ${seenCount}` : 'Sent'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {typingUser && (
                <div className="px-6 py-1 text-xs text-slate-500">{typingUser} is typing...</div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3"
              >
                <input
                  type="text"
                  disabled={group.status === 'closed'}
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    socketRef.current?.emit('typing:start', groupId);
                  }}
                  onBlur={() => socketRef.current?.emit('typing:stop', groupId)}
                  placeholder={group.status === 'closed' ? 'Group is closed' : 'Write a message to your group...'}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-700 focus:outline-none disabled:bg-slate-100"
                />
                <button
                  type="submit"
                  disabled={group.status === 'closed' || !chatInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
