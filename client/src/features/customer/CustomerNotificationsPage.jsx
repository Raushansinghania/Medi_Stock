import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  FileText,
  Package,
  CreditCard,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerNotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('all');

  // Fetch notifications
  const { data: notifData, isLoading } = useQuery({
    queryKey: ['customer-notifications-full'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
  });

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unreadCount || 0;

  // Mark single read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notifications-full'] });
      queryClient.invalidateQueries({ queryKey: ['customer-notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['customer-dashboard-metrics'] });
    },
  });

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notifications-full'] });
      queryClient.invalidateQueries({ queryKey: ['customer-notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['customer-dashboard-metrics'] });
    },
  });

  const filteredNotifs = notifications.filter((n) => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'prescription':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'order':
        return <Package className="w-5 h-5 text-teal-600" />;
      case 'payment':
        return <CreditCard className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-amber-600" />;
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications & Alerts</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time updates regarding your prescription verifications and order delivery schedules
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold self-start sm:self-auto transition-colors"
          >
            <CheckCheck className="w-4 h-4 text-teal-600" /> Mark All as Read ({unreadCount})
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
        {['all', 'order', 'prescription', 'general'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={cn(
              'px-3.5 py-1.5 rounded-full font-semibold capitalize transition-colors',
              filterType === t
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {t === 'all' ? 'All Alerts' : `${t} Updates`}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Loading notifications..." />
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-2xs">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No notifications</h3>
          <p className="text-xs text-slate-500 mt-1">
            You're all caught up! You will be notified when your orders or prescriptions receive updates.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {filteredNotifs.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={cn(
                'p-5 flex items-start gap-4 transition-colors cursor-pointer',
                !n.is_read ? 'bg-teal-50/40 hover:bg-teal-50/60' : 'hover:bg-slate-50/70'
              )}
            >
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {getTypeIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{n.title}</h4>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" />
                  )}
                </div>

                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>

                <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleString()}
                  </span>
                  {n.link && (
                    <span className="text-teal-700 font-semibold hover:underline flex items-center gap-0.5">
                      Open Details <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
