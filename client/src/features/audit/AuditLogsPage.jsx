import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { ShieldCheck, Search, Filter, RefreshCw } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', actionFilter],
    queryFn: async () => {
      try {
        const param = actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : '';
        const res = await api.get(`/audit-logs${param}`);
        return res.data;
      } catch {
        return [];
      }
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Security & Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable transaction log of user logins, role modifications, purchases, sales, and return events
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="w-4 h-4 text-teal-600" /> Refresh Trail
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by action name (e.g. SALE, PURCHASE, USER)..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="lg" text="Loading audit trails from MySQL..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No audit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Target ID</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500">{log.created_at}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 uppercase text-[11px] text-slate-500 font-semibold">
                      {log.entity_type || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">#{log.entity_id || '—'}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.user_name ? `${log.user_name} (${log.user_role})` : 'System Automatic'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-sm truncate font-mono text-[11px]">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
