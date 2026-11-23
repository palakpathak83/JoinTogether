import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ApiError, apiRequest } from '../lib/api.ts';
import type { User } from '../types/index.ts';

export default function ProfilePage() {
  const { user, setUserDirect } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(user?.city || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [skillsText, setSkillsText] = useState((user?.skills || []).join(', '));
  const [interestsText, setInterestsText] = useState((user?.interests || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    try {
      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean);
      const interests = interestsText.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await apiRequest<{ user: User }>('/api/auth/me', {
        method: 'PATCH',
        body: { name, city, bio, skills, interests },
      });
      setUserDirect(res.user);
      setSaved('Profile updated in MongoDB.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Profile & Preferences</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your city, bio, skills, and interests help peers evaluate match requests.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {saved}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Bio</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Skills (comma-separated)</label>
          <input
            type="text"
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Interests (comma-separated)</label>
          <input
            type="text"
            value={interestsText}
            onChange={(e) => setInterestsText(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
          />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="font-mono text-xs text-slate-500">Role: {user?.role}</span>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
