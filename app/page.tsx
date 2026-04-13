"use client";

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, BarChart3, ClipboardCheck, Clock, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Home() {
  // --- BETA AUTH STATE ---
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [betaKey, setBetaKey] = useState('');

  // --- EXISTING APP STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logText, setLogText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [allLogs, setAllLogs] = useState<any[]>([]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setAllLogs(data || []);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchLogs();
    }
  }, [isAuthorized]);

  const handleSaveLog = async () => {
    if (!logText) return alert("Please type something first!");
    setIsSaving(true);

    const { error } = await supabase
      .from('daily_logs')
      .insert([{ 
          notes: logText, 
          project_name: 'Bayfield St. Job',
          weather: 'Clear' 
      }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      setLogText('');
      fetchLogs();
    }
    setIsSaving(false);
  };

  const handleBetaEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (betaKey.toLowerCase() === 'ontario2026') {
      setIsAuthorized(true);
    } else {
      alert("Invalid Beta Access Key");
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'logs', label: 'Daily Logs', icon: <FileText size={18} /> },
    { id: 'bids', label: 'Bid Tool', icon: <BarChart3 size={18} /> },
    { id: 'financials', label: 'Financials', icon: <ClipboardCheck size={18} /> },
  ];

  // --- RENDER BETA GATE ---
  if (!isAuthorized) {
    return (
      <main className="h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <form onSubmit={handleBetaEntry} className="max-w-sm w-full space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black italic shadow-2xl shadow-blue-900/40 text-white">
              S
            </div>
            <h1 className="text-2xl font-black uppercase italic text-white tracking-tighter">
              SiteMaster <span className="text-blue-500">QA</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
              <Lock size={10} /> Early Access Protocol
            </p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="password" 
              placeholder="Enter Beta Key" 
              autoFocus
              className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-center font-black uppercase tracking-widest text-blue-500 outline-none focus:border-blue-500 transition-all shadow-inner"
              value={betaKey}
              onChange={(e) => setBetaKey(e.target.value)}
            />
            <button 
              type="submit"
              className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase text-xs text-white shadow-xl hover:bg-blue-500 transition-all active:scale-95"
            >
              Initialize Deployment
            </button>
          </div>
          
          <p className="text-[9px] font-bold text-slate-700 uppercase">
            &copy; 2026 SiteMaster Systems | Ontario, CA
          </p>
        </form>
      </main>
    );
  }

  // --- RENDER MAIN APP ---
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 animate-in fade-in duration-700">
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">PM Portal</h1>
            <p className="text-xs text-slate-500 font-medium">Barrie, ON | Interior Systems</p>
          </div>
          <button 
            onClick={() => setIsAuthorized(false)}
            className="text-[10px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors"
          >
            Lock Terminal
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-8">
        <div className="max-w-5xl mx-auto flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-2 transition-all font-medium text-sm ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <section className="p-8 max-w-5xl mx-auto">
        {activeTab === 'dashboard' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold">Welcome back, Bill.</h2>
            <p className="text-slate-500">You have {allLogs.length} total logs stored in the cloud.</p>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4">New Site Entry</h2>
              <textarea 
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                className="w-full p-4 border rounded-xl h-40 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="What did we get done today?"
              />
              <button 
                onClick={handleSaveLog}
                disabled={isSaving}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isSaving ? 'Saving...' : 'Submit Daily Log'}
              </button>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Clock size={20} className="text-slate-400" />
                Recent History
              </h2>
              {allLogs.length === 0 ? (
                <p className="text-slate-400 italic">No logs found yet...</p>
              ) : (
                allLogs.map((log) => (
                  <div key={log.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                        {log.project_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{log.notes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}