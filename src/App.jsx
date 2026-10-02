import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Printer, AlertTriangle, Users, CheckCircle2, Clock, RotateCcw, MapPin, Zap } from 'lucide-react';

export default function App() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [activeCheckIn, setActiveCheckIn] = useState(null); // { centerId, timestamp }

  useEffect(() => {
    fetchCenters();
    loadActiveCheckIn();

    const channel = supabase
      .channel('realtime_print_centers')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'print_centers' },
        (payload) => {
          setCenters((prev) =>
            prev.map((c) => (c.id === payload.new.id ? payload.new : c))
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsLive(true);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCenters = async () => {
    const { data } = await supabase
      .from('print_centers')
      .select('*')
      .order('id', { ascending: true });

    if (data) setCenters(data);
    setLoading(false);
  };

  const loadActiveCheckIn = () => {
    const raw = localStorage.getItem('printrush_active_queue');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const diffMinutes = (Date.now() - parsed.timestamp) / 60000;
      if (diffMinutes < 15) {
        setActiveCheckIn(parsed);
      } else {
        localStorage.removeItem('printrush_active_queue');
        setActiveCheckIn(null);
      }
    } catch {
      localStorage.removeItem('printrush_active_queue');
    }
  };

  const handleJoinQueue = async (center) => {
    // Accountability rule: Cannot join multiple queues simultaneously
    if (activeCheckIn) return;

    const newCount = center.queue_count + 1;
    const checkInData = { centerId: center.id, timestamp: Date.now() };

    localStorage.setItem('printrush_active_queue', JSON.stringify(checkInData));
    setActiveCheckIn(checkInData);

    setCenters((prev) =>
      prev.map((c) => (c.id === center.id ? { ...c, queue_count: newCount } : c))
    );

    await supabase
      .from('print_centers')
      .update({ queue_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', center.id);
  };

  const handleLeaveQueue = async (center) => {
    // Accountability guard: strictly block decrementing unless checked into THIS center
    if (activeCheckIn?.centerId !== center.id) return;

    const newCount = Math.max(0, center.queue_count - 1);

    localStorage.removeItem('printrush_active_queue');
    setActiveCheckIn(null);

    setCenters((prev) =>
      prev.map((c) => (c.id === center.id ? { ...c, queue_count: newCount } : c))
    );

    await supabase
      .from('print_centers')
      .update({ queue_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', center.id);
  };

  const handleResetQueue = async (center) => {
    if (activeCheckIn?.centerId === center.id) {
      localStorage.removeItem('printrush_active_queue');
      setActiveCheckIn(null);
    }

    setCenters((prev) =>
      prev.map((c) => (c.id === center.id ? { ...c, queue_count: 0 } : c))
    );

    await supabase
      .from('print_centers')
      .update({ queue_count: 0, updated_at: new Date().toISOString() })
      .eq('id', center.id);
  };

  const toggleIssue = async (center, field) => {
    const nextVal = !center[field];

    setCenters((prev) =>
      prev.map((c) => (c.id === center.id ? { ...c, [field]: nextVal } : c))
    );

    await supabase
      .from('print_centers')
      .update({ [field]: nextVal, updated_at: new Date().toISOString() })
      .eq('id', center.id);
  };

  // Fastest operational center for instant sub-3s decision
  const operationalCenters = centers.filter((c) => !c.is_jammed);
  const bestCenterId = operationalCenters.length > 0
    ? operationalCenters.reduce((prev, curr) => (prev.queue_count <= curr.queue_count ? prev : curr)).id
    : null;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col items-center p-4 sm:p-7 font-sans antialiased selection:bg-amber-400 selection:text-black">
      <div className="w-full max-w-md space-y-4">
        
        {/* Header */}
        <header className="border-b border-slate-800/90 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400">
                <Printer className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                PrintRush
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                ⏱️ &lt;10s Pick
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{isLive ? 'Live Sync' : 'Connecting'}</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 font-medium mt-1.5">
            VIT Pune Campus Xerox Tracker
          </p>
        </header>

        {/* Center Cards Feed */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-slate-900/60 rounded-xl animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : (
          <main className="space-y-3" role="list">
            {centers.map((center) => {
              const isJam = center.is_jammed;
              const isLowPaper = !center.is_paper_stocked;
              const estWaitMins = Math.ceil(center.queue_count * 1.5);
              const isBest = center.id === bestCenterId && !isJam;
              const isCurrentChecked = activeCheckIn?.centerId === center.id;
              const isInOtherQueue = activeCheckIn && !isCurrentChecked;

              return (
                <section
                  key={center.id}
                  className={`p-4 rounded-xl border transition-all duration-200 relative ${
                    isBest
                      ? 'bg-slate-900/95 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                      : isJam
                      ? 'bg-slate-900/40 border-rose-900/40 opacity-90'
                      : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {isBest && (
                    <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Zap className="w-3 h-3 fill-emerald-300" />
                      Best Pick Now
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-[15px] font-bold text-white tracking-tight">
                        {center.name}
                      </h2>
                      <p className="text-xs text-slate-200 font-medium flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>{center.location}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end text-sm font-extrabold text-white">
                        <Users className="w-3.5 h-3.5 text-slate-300" />
                        <span>{center.queue_count} waiting</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium flex items-center gap-1 mt-0.5 justify-end">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>~{estWaitMins}m wait</span>
                      </p>
                    </div>
                  </div>

                  {/* Hardware Toggles */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => toggleIssue(center, 'is_jammed')}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                        isJam
                          ? 'bg-rose-950/70 text-rose-300 border-rose-700/60 font-semibold'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {isJam ? 'Jammed' : 'No Jam'}
                    </button>

                    <button
                      onClick={() => toggleIssue(center, 'is_paper_stocked')}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                        isLowPaper
                          ? 'bg-amber-950/70 text-amber-300 border-amber-700/60 font-semibold'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {isLowPaper ? 'Out of Paper' : 'Paper Stocked'}
                    </button>

                    {center.queue_count > 0 && (
                      <button
                        onClick={() => handleResetQueue(center)}
                        title="Reset if line is visibly empty"
                        className="ml-auto text-[11px] font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Line Empty?</span>
                      </button>
                    )}
                  </div>

                  {/* Accountable Actions */}
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80">
                    {isCurrentChecked ? (
                      /* Checked in here: Show status + active Leave button */
                      <div className="flex gap-2">
                        <div className="flex-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span>In Line (Active 15m)</span>
                        </div>
                        <button
                          onClick={() => handleLeaveQueue(center)}
                          className="flex-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold py-2 rounded-lg text-xs transition active:scale-95 cursor-pointer"
                        >
                          Done / Left Queue
                        </button>
                      </div>
                    ) : isInOtherQueue ? (
                      /* Checked in elsewhere: Disabled */
                      <button
                        disabled
                        title="Leave your active queue first to join this one"
                        className="w-full bg-slate-800/40 text-slate-500 font-medium py-2 rounded-lg text-xs border border-slate-800/60 cursor-not-allowed opacity-60"
                      >
                        In Another Queue
                      </button>
                    ) : (
                      /* Not in any line: Full-width Join button */
                      <button
                        onClick={() => handleJoinQueue(center)}
                        className="w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold py-2 rounded-lg text-xs transition active:scale-95 cursor-pointer shadow"
                      >
                        + I'm in line
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </main>
        )}

        {/* Footer */}
        <footer className="pt-3 border-t border-slate-800/80 flex justify-between items-center text-[11px] text-slate-400">
          <span>Constraint #5: &lt;10s Utility</span>
          <span>Verified Check-in Lock</span>
        </footer>

      </div>
    </div>
  );
}