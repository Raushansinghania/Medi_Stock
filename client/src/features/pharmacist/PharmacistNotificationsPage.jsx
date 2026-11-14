import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ClockAlert,
  FileCheck2,
  Boxes,
  RotateCcw,
  Check,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistNotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pharmacist-notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications/my');
      return res.data;
    },
    refetchInterval: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard-badges'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard-badges'] });
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const getIcon = (type) => {
    switch (type) {
      case 'prescription':
        return <FileCheck2 className="w-4 h-4 text-amber-600" />;
      case 'expiry':
        return <ClockAlert className="w-4 h-4 text-red-600" />;
      case 'inventory':
      case 'stock':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'return':
        return <RotateCcw className="w-4 h-4 text-teal-600" />;
      default:
        return <Bell className="w-4 h-4 text-teal-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-teal-600" />
            Pharmacist Operational Notifications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time dispensing queue alerts, low-stock threshold triggers, near-expiry warnings, and return inspections.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold shadow-sm transition"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-400 mt-2">Loading alert feed...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 text-sm">No new notifications</p>
            <p className="text-slate-400 mt-1">Operational alerts will appear here as orders and prescriptions arrive.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-3 transition ${
                  !n.is_read ? 'bg-teal-50/30' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      {n.link && (
                        <Link
                          to={n.link}
                          className="font-bold text-teal-600 hover:text-teal-700 inline-flex items-center gap-0.5"
                        >
                          View Details <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markReadMutation.mutate(n.id)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 transition"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
