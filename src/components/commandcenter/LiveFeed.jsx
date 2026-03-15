import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import moment from 'moment';
import { Users, Star, Clock, Activity } from 'lucide-react';

const EVENT_TYPES = {
  checkin: { icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Checked In' },
  review: { icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'New Review' },
  waitlist: { icon: Clock, color: 'text-indigo-400', bg: 'bg-indigo-400/10', label: 'Joined Waitlist' },
};

function FeedItem({ event, isNew }) {
  const cfg = EVENT_TYPES[event.type];
  const Icon = cfg.icon;
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border border-[#222] transition-all duration-500 ${isNew ? 'border-indigo-500/40 bg-indigo-500/5' : 'bg-[#111]'}`}
    >
      <div className={`p-1.5 rounded-lg shrink-0 ${cfg.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium leading-snug truncate">{event.name}</p>
        <p className="text-xs text-slate-500 truncate">{event.detail}</p>
      </div>
      <span className="text-[10px] text-slate-600 shrink-0 mt-0.5">{moment(event.ts).fromNow()}</span>
    </div>
  );
}

export default function LiveFeed({ restaurantId }) {
  const [events, setEvents] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const seenIds = useRef(new Set());
  const isFirst = useRef(true);
  const isFetching = useRef(false);

  const fetchEvents = async () => {
    if (!restaurantId || isFetching.current) return;
    isFetching.current = true;
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    const checkins = await base44.entities.Reservation.filter({ restaurant_id: restaurantId, status: 'checked_in' }, '-checked_in_at', 15);
    await delay(200);
    const reviews = await base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }, '-created_date', 15);
    await delay(200);
    const waitlist = await base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId }, '-created_date', 15);

    const combined = [
      ...checkins.map(r => ({
        id: `ci-${r.id}`,
        type: 'checkin',
        name: r.user_name || 'A guest',
        detail: `Party of ${r.party_size} checked in`,
        ts: r.checked_in_at || r.updated_date,
      })),
      ...reviews.map(r => ({
        id: `rv-${r.id}`,
        type: 'review',
        name: r.user_name || 'Anonymous',
        detail: `Left a ${r.rating}★ review`,
        ts: r.created_date,
      })),
      ...waitlist.map(w => ({
        id: `wl-${w.id}`,
        type: 'waitlist',
        name: w.guest_name || 'A guest',
        detail: `Party of ${w.party_size} joined the waitlist`,
        ts: w.created_date,
      })),
    ]
      .filter(e => e.ts)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 20);

    if (!isFirst.current) {
      const fresh = new Set(combined.filter(e => !seenIds.current.has(e.id)).map(e => e.id));
      if (fresh.size > 0) {
        setNewIds(fresh);
        setTimeout(() => setNewIds(new Set()), 3000);
      }
    }
    isFirst.current = false;
    combined.forEach(e => seenIds.current.add(e.id));
    setEvents(combined);
    isFetching.current = false;
  };

  useEffect(() => { fetchEvents(); }, [restaurantId]);
  useEffect(() => {
    const interval = setInterval(fetchEvents, 60_000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  return (
    <div className="rounded-xl border border-[#222] bg-[#0d0d0d] flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#222]">
        <Activity className="w-4 h-4 text-indigo-400" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Live Feed</h3>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Live
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 p-3" style={{ maxHeight: 420 }}>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-xs text-center">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            Waiting for activity...
          </div>
        ) : events.map(e => (
          <FeedItem key={e.id} event={e} isNew={newIds.has(e.id)} />
        ))}
      </div>
    </div>
  );
}