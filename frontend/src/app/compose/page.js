'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../lib/useAuth';
import { api } from '../../lib/api';

export default function ComposePage() {
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await api.scheduleEmail({
        recipient,
        subject,
        body,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  const minDateTime = now.toISOString().slice(0, 16);

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Schedule an Email</h1>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded">
            Email scheduled! Redirecting to dashboard...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="recipient@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Email subject"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={5}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Write your email..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule For</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
                min={minDateTime}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Scheduling...' : 'Schedule Email'}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
