'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../lib/useAuth';
import { api } from '../../lib/api';

export default function DashboardPage() {
  const { loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ scheduled: 0, sent: 0, failed: 0, total: 0 });
  const [emails, setEmails] = useState([]);
  const [tab, setTab] = useState('scheduled');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, emailsData] = await Promise.all([
        api.getStats(),
        api.getEmails(tab),
      ]);
      setStats(statsData);
      setEmails(emailsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  const statCards = [
    { label: 'Scheduled', value: stats.scheduled, color: 'bg-blue-50 text-blue-700' },
    { label: 'Sent', value: stats.sent, color: 'bg-green-50 text-green-700' },
    { label: 'Failed', value: stats.failed, color: 'bg-red-50 text-red-700' },
    { label: 'Total', value: stats.total, color: 'bg-gray-50 text-gray-700' },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <Link
            href="/compose"
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700"
          >
            + New Email
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className={`rounded-lg p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-sm mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {['scheduled', 'sent', 'failed'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize -mb-px ${
                tab === t
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>
        ) : emails.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No {tab} emails yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="pb-2 font-medium">Recipient</th>
                  <th className="pb-2 font-medium">Subject</th>
                  <th className="pb-2 font-medium">Scheduled At</th>
                  {tab === 'sent' && <th className="pb-2 font-medium">Sent At</th>}
                  {tab === 'failed' && <th className="pb-2 font-medium">Error</th>}
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-900">{email.recipient}</td>
                    <td className="py-3 text-gray-700">{email.subject}</td>
                    <td className="py-3 text-gray-500">{formatDate(email.scheduled_at)}</td>
                    {tab === 'sent' && (
                      <td className="py-3 text-gray-500">{formatDate(email.sent_at)}</td>
                    )}
                    {tab === 'failed' && (
                      <td className="py-3 text-red-500 text-xs">{email.error_message || '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
