import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  Boxes,
  ShoppingCart,
  CheckCheck,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('all');

  const { data: notifData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
    refetchInterval: 20000,
  });

  const notifications = notifData?.notifications || (Array.isArray(notifData) ? notifData : []);
  const unreadCount = notifData?.unread_count || notifications.filter((n) => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/notifications/mark-all-read');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const filtered = notifications.filter((n) => {
    if (filterType === 'unread') return !n.is_read;
    if (filterType !== 'all') return n.type === filterType;
    return true;
  });

  const getIcon = (type) => {
    switch (type) {
      case 'prescription':
        return <FileText className="w-4 h-4 text-teal-600" />;
      case 'order':
        return <ShoppingCart className="w-4 h-4 text-blue-600" />;
      case 'system':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <Bell className="w-3.5 h-3.5" /> Operational Intelligence Feed
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications & Alerts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time triggers for inventory depletion, batch expirations, purchase approvals, and clinical queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <CheckCheck className="w-4 h-4" /> Mark All as Read ({unreadCount})
            </button>
          )}

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'all', label: 'All Alerts' },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'prescription', label: 'Prescriptions' },
          { id: 'order', label: 'Orders & POs' },
          { id: 'system', label: 'System & Stock' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" message="Loading notifications..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No notifications to display</p>
            <p className="text-xs text-slate-400 mt-1">All clinical and operational systems are running normally.</p>
          </div>
        ) : (
          filtered.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-xl border transition-all ${
                notif.is_read
                  ? 'bg-white border-slate-200 shadow-sm opacity-80'
                  : 'bg-teal-50/40 border-teal-200 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    {getIcon(notif.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {notif.title}
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-teal-600 inline-block"></span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 mt-2 inline-block">
                      {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just now'}
                    </span>
                  </div>
                </div>

                {!notif.is_read && (
                  <button
                    onClick={() => markReadMutation.mutate(notif.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-teal-600 hover:bg-slate-100"
                    title="Mark as read"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
