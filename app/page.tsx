"use client"; // This tells Next.js this page is interactive

import React, { useState } from 'react';
import { LayoutDashboard, FileText, BarChart3, HardHat, ClipboardCheck } from 'lucide-react';

export default function Home() {
  // This is our "Brain" - it defaults to the 'dashboard' tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Define our tabs for easy management
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'logs', label: 'Daily Logs', icon: <FileText size={18} /> },
    { id: 'bids', label: 'Bid Tool', icon: <BarChart3 size={18} /> },
    { id: 'financials', label: 'Financials', icon: <ClipboardCheck size={18} /> },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* 1. TOP HEADER */}
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Project Management</h1>
            <p className="text-xs text-slate-500 font-medium">Barrie, ON | Interior Systems</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">System Online</span>
          </div>
        </div>
      </header>

      {/* 2. HORIZONTAL TABS NAVIGATION */}
      <nav className="bg-white border-b border-slate-200 px-8">
        <div className="max-w-5xl mx-auto flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-2 transition-all font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 3. DYNAMIC CONTENT AREA */}
      <section className="p-8 max-w-5xl mx-auto">
        
        {/* DASHBOARD TAB CONTENT */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Active Bids</p>
                <p className="text-3xl font-bold text-slate-900">12</p>
              </div>
              <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Open Punchlist</p>
                <p className="text-3xl font-bold text-orange-600">4</p>
              </div>
              <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Days to Completion</p>
                <p className="text-3xl font-bold text-blue-600">18</p>
              </div>
            </div>
          </div>
        )}

        {/* DAILY LOGS TAB CONTENT */}
        {activeTab === 'logs' && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto">
            <h2 className="text-xl font-bold mb-4">Site Entry: {new Date().toLocaleDateString()}</h2>
            <textarea 
              className="w-full p-4 border rounded-xl h-32 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="What interior systems were installed today? (e.g., Taping, Bulkheads, Framing...)"
            />
            <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
              Submit Daily Log
            </button>
          </div>
        )}

        {/* BID TOOL TAB CONTENT */}
        {activeTab === 'bids' && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
            <HardHat className="mx-auto text-slate-300 mb-4" size={48} />
            <h2 className="text-xl font-bold">Bid Leveling Tool</h2>
            <p className="text-slate-500 mt-2">Compare quotes from your Drywall and Acoustic subs side-by-side.</p>
            <button className="mt-6 px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              + Start New Bid Comparison
            </button>
          </div>
        )}

        {/* FINANCIALS TAB CONTENT */}
        {activeTab === 'financials' && (
          <div className="text-center py-20">
            <p className="text-slate-400">Project Financial Ledger - Coming in Step 4!</p>
          </div>
        )}

      </section>
    </main>
  );
}