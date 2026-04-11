"use client";

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, BarChart3, ClipboardCheck, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logText, setLogText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [allLogs, setAllLogs] = useState<any[]>([]); // This holds your data from the cloud

  // 1. THE "READ" FUNCTION (Fetch data from Supabase)
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

  // 2. THE "WATCHER" (Runs the fetch when the page first loads)
  useEffect(() => {
    fetchLogs();
  }, []);

  // 3. THE "WRITE" FUNCTION (Saves to cloud and then refreshes the list)
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
      setLogText(''); // Clear the box
      fetchLogs();    // Refresh the list immediately
    }
    setIsSaving(false);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'logs', label: 'Daily Logs', icon: <FileText size={18} /> },
    { id: 'bids', label: 'Bid Tool', icon: <BarChart3 size={18} /> },
    { id: 'financials', label: 'Financials', icon: <ClipboardCheck size={18} /> },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">PM Portal</h1>
            <p className="text-xs text-slate-500 font-medium">Barrie, ON | Interior Systems</p>
          </div>
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
            {/* INPUT COLUMN */}
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

            {/* HISTORY COLUMN */}
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