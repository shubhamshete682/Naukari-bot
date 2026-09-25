"use client";

import { useState, useEffect } from "react";
import { Briefcase, MapPin, Search, CheckCircle, Clock, Zap } from "lucide-react";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  posted: string;
  url: string;
};

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [applyResults, setApplyResults] = useState<any[]>([]);

  // Push Subscription & Auto-Apply Logic
  useEffect(() => {
    const setupPush = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.register('/push-sw.js');
          
          // Request permission
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
            // Convert VAPID key
            const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
            const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              outputArray[i] = rawData.charCodeAt(i);
            }

            let subscription = await reg.pushManager.getSubscription();
            if (!subscription) {
              subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray
              });
            }

            // Send subscription to our server to save in Supabase
            await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(subscription)
            });
          }
        } catch (err) {
          console.error("Push setup failed", err);
        }
      }
    };
    
    setupPush();

    // Handle One-Click Apply from Notification
    const query = new URLSearchParams(window.location.search);
    const applyUrl = query.get('applyUrl');
    if (applyUrl) {
       // Clear the URL so we don't spam apply on refresh
       window.history.replaceState({}, document.title, "/");
       setLoadingApply(true);
       fetch("/api/apply", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ jobUrls: [applyUrl] }),
       }).then(res => res.json()).then(data => {
         setLoadingApply(false);
         if (data.success) {
           alert("Successfully applied from notification!");
         } else {
           alert("Apply failed: " + data.error);
         }
       });
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSearch(true);
    setJobs([]);
    setApplyResults([]);
    
    try {
      const url = new URL("/api/jobs", window.location.origin);
      if (keyword) url.searchParams.append("keyword", keyword);
      if (location) url.searchParams.append("location", location);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.jobs) {
        // Filter out jobs we've already applied to locally
        const history = JSON.parse(localStorage.getItem('appliedJobs') || '[]');
        const unappliedJobs = data.jobs.filter((j: Job) => !history.includes(j.id));
        setJobs(unappliedJobs);
      } else {
        alert("Error fetching jobs: " + data.error);
      }
    } catch (err: any) {
      alert("Search failed: " + err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedJobs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedJobs(newSet);
  };

  const selectAll = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map(j => j.id)));
    }
  };

  const handleApply = async () => {
    if (selectedJobs.size === 0) return;
    
    const confirmApply = confirm(`Are you sure you want to apply to ${selectedJobs.size} jobs?`);
    if (!confirmApply) return;

    setLoadingApply(true);
    const urls = jobs.filter(j => selectedJobs.has(j.id)).map(j => j.url);

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobUrls: urls }),
      });
      const data = await res.json();
      
      if (data.success) {
        setApplyResults(data.results);
        
        // Save successfully applied jobs to localStorage
        const successfulUrls = data.results.filter((r: any) => r.status === 'Applied').map((r: any) => r.url);
        const successfulIds = jobs.filter(j => successfulUrls.includes(j.url)).map(j => j.id);
        
        const history = JSON.parse(localStorage.getItem('appliedJobs') || '[]');
        localStorage.setItem('appliedJobs', JSON.stringify([...history, ...successfulIds]));
        
        // Remove them from the current view
        setJobs(prev => prev.filter(j => !successfulIds.includes(j.id)));
        setSelectedJobs(new Set());
      } else {
        alert("Error applying: " + data.error);
      }
    } catch (err: any) {
      alert("Application process failed: " + err.message);
    } finally {
      setLoadingApply(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <div className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <Zap className="w-6 h-6 text-yellow-300" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NaukriBot</h1>
              <p className="text-blue-100 text-sm">Automated Job Applications</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {/* Search Card */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Briefcase className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Tech Stack (e.g. React, Node)"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Location (e.g. Remote, Bangalore)"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loadingSearch}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loadingSearch ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              <span>{loadingSearch ? "Scanning..." : "Find Jobs"}</span>
            </button>
          </form>
        </section>

        {/* Apply Results */}
        {applyResults.length > 0 && (
          <section className="bg-green-50 border border-green-200 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Application Report
            </h3>
            <ul className="space-y-2">
              {applyResults.map((r, i) => (
                <li key={i} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-white p-3 rounded-lg shadow-sm">
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 truncate max-w-xs hover:underline">
                    {r.url}
                  </a>
                  <span className={`font-semibold mt-2 sm:mt-0 ${r.status === 'Applied' ? 'text-green-600' : 'text-orange-500'}`}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Results Section */}
        {jobs.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Found {jobs.length} Jobs
              </h2>
              <button
                onClick={selectAll}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                {selectedJobs.size === jobs.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="grid gap-4">
              {jobs.map((job) => (
                <label
                  key={job.id}
                  className={`relative flex items-start gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer bg-white ${
                    selectedJobs.has(job.id) ? "border-blue-500 shadow-md shadow-blue-100" : "border-transparent hover:border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => toggleSelection(job.id)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg leading-tight mb-1 text-slate-800">{job.title}</h3>
                    <p className="text-slate-600 font-medium mb-3">{job.company}</p>
                    
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> {job.experience}
                      </span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {job.posted}
                      </span>
                    </div>
                  </div>
                  <a 
                    href={job.url} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()} 
                    className="absolute top-5 right-5 text-sm text-blue-600 hover:underline font-medium"
                  >
                    View
                  </a>
                </label>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Floating Action Button */}
      {selectedJobs.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] flex justify-center z-50">
          <button
            onClick={handleApply}
            disabled={loadingApply}
            className="w-full max-w-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loadingApply ? (
              <>
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Applying via Automation...</span>
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" fill="currentColor" />
                <span>Apply to {selectedJobs.size} Jobs Now</span>
              </>
            )}
          </button>
        </div>
      )}
    </main>
  );
}
