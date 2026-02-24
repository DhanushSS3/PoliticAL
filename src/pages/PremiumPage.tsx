import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MessageCircle, BadgeCheck, BadgeDollarSign, FileText, Bot } from 'lucide-react';
import { materialService } from '../services/materialService';
import { jobService } from '../services/jobService';
import { meetingService, type PremiumMeeting } from '../services/meetingService';

type Material = {
  _id: string;
  name: string;
  url: string;
  createdAt: string;
  mimetype?: string;
};

const PremiumPage: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  // Meetings state
  const [meetings, setMeetings] = useState<PremiumMeeting[]>([]);
  const [mLoading, setMLoading] = useState(false);
  const [mError, setMError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const API_URL = (import.meta as any).env?.VITE_API_URL || 'https://www.careerredefine.com';
  // Which detailed section is open; null => only show 5 cards
  const [active, setActive] = useState<null | 'exclusive-tools' | 'priority-support' | 'meetings' | 'groups' | 'materials' | 'premium-jobs'>(null);
  // Jobs state for admin-added jobs
  const [jobs, setJobs] = useState<any[]>([]);
  const [jLoading, setJLoading] = useState(false);
  const [jError, setJError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await materialService.list(); // { materials }
        setMaterials(data?.materials || []);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load materials');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadMeetings = async () => {
      setMLoading(true);
      setMError(null);
      try {
        const list = await meetingService.mine();
        setMeetings(list);
      } catch (e: any) {
        setMError(e?.response?.data?.message || e?.message || 'Failed to load meetings');
      } finally {
        setMLoading(false);
      }
    };
    loadMeetings();
  }, []);

  // Load admin-added jobs when Premium Jobs view is active
  useEffect(() => {
    if (active !== 'premium-jobs') return;
    let mounted = true;
    (async () => {
      try {
        setJLoading(true);
        setJError(null);
        const data = await jobService.getJobs({ limit: 20 });
        if (mounted) setJobs(data);
      } catch (e: any) {
        if (mounted) setJError(e?.response?.data?.message || e?.message || 'Failed to load jobs');
      } finally {
        if (mounted) setJLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [active]);

  // Countdown helper
  const getCountdown = (iso?: string) => {
    if (!iso) return '';
    const target = new Date(iso).getTime();
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) return 'Starting now';
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMError(null);
      await meetingService.create({ name: form.name, email: form.email, message: form.message });
      const list = await meetingService.mine();
      setMeetings(list);
      setForm({ name: '', email: '', message: '' });
    } catch (e: any) {
      setMError(e?.response?.data?.message || e?.message || 'Failed to submit meeting request');
    }
  };

  return (
    <>
    <div className="container mx-auto px-4 py-10">
      {active === null ? (
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {/* Exclusive Tools */}
          <button onClick={() => navigate('/tools')} className="text-left block group w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 p-6">
            <div className="h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-200/40">
              <span className="text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Exclusive Tools</span>
            </div>
            <div className="mt-3 text-sm text-gray-600">Click to view and open all premium tools.</div>
          </button>

          {/* Priority Support */}
          <button onClick={() => setActive('priority-support')} className="text-left block group w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 p-6">
            <div className="h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-200/40">
              <span className="text-xl font-extrabold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">Priority Support</span>
            </div>
            <div className="mt-3 text-sm text-gray-600">Direct call and WhatsApp support.</div>
          </button>

          {/* Meetings */}
          <button onClick={() => setActive('meetings')} className="text-left block group w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 p-6">
            <div className="h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200/40">
              <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Meetings</span>
            </div>
            <div className="mt-3 text-sm text-gray-600">Request and join approved sessions.</div>
          </button>

          {/* Groups */}
          <button onClick={() => setActive('groups')} className="text-left block group w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 p-6">
            <div className="h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10 border border-fuchsia-200/40">
              <span className="text-xl font-extrabold bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent">Groups</span>
            </div>
            <div className="mt-3 text-sm text-gray-600">Collaborate with your premium cohorts.</div>
          </button>

          {/* Materials */}
          <button onClick={() => setActive('materials')} className="text-left block group w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 p-6 lg:col-span-1">
            <div className="h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200/40">
              <span className="text-xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">Materials</span>
            </div>
            <div className="mt-3 text-sm text-gray-600">Access shared documents and resources.</div>
          </button>

          {/* Premium Jobs */}
          <button onClick={() => setActive('premium-jobs')} className="text-left block group w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 p-6 lg:col-span-1">
            <div className="h-24 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-200/40">
              <span className="text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Premium Jobs</span>
            </div>
            <div className="mt-3 text-sm text-gray-600">View jobs curated and added by admin (premium only).</div>
          </button>
        </div>
      ) : active === 'exclusive-tools' ? (
        <>
          {/* Back button outside the container, left aligned on top */}
          <div className="max-w-6xl mx-auto mb-3">
            <button onClick={() => setActive(null)} className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Back</button>
          </div>
          <div id="exclusive-tools" className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Exclusive Tools</h1>
              <Link to="/tools" className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">Open Tools</Link>
            </div>
            <p className="text-gray-600 mb-6">
              Welcome to the premium area. As a premium member, you have exclusive access to tools, content,
              and support. More features will appear here as we roll them out.
            </p>
            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800 mb-1">Exclusive Tools</h2>
                <p className="text-sm text-gray-600 mb-3">Access premium AI tools and advanced resources.</p>
                <Link
                  to="/tools"
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Open Tools
                </Link>
              </div>
              <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-800 mb-1">Priority Support</h2>
                <p className="text-sm text-gray-600 mb-3">Get faster responses from our support team.</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="tel:+918618536940"
                    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Call
                  </a>
                  <a
                    href="https://wa.me/918618536940"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Chat with Mentor
                  </a>
                </div>
              </div>
            </div>

            {/* Tools grid styled like Tools page */}
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">All Tools</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Card 1 */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-5 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 p-[2px] shadow mb-4">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-800">
                        <Search className="w-7 h-7" />
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">AI-Powered Career Pathfinding</div>
                    <p className="text-sm text-gray-600 mt-1 mb-4">Reveal high-fit career paths based on your skills and passions.</p>
                    <button onClick={() => navigate('/tools')} className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm hover:bg-indigo-700">Open</button>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-5 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 p-[2px] shadow mb-4">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-800">
                        <MessageCircle className="w-7 h-7" />
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">Dynamic Interview Simulator</div>
                    <p className="text-sm text-gray-600 mt-1 mb-4">Practice role-specific interviews with adaptive questions.</p>
                    <button onClick={() => navigate('/tools')} className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm hover:bg-emerald-700">Open</button>
                  </div>
                </div>
                {/* Card 3 */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-5 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 p-[2px] shadow mb-4">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-800">
                        <BadgeCheck className="w-7 h-7" />
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">Skill Gap Identifier</div>
                    <p className="text-sm text-gray-600 mt-1 mb-4">Pinpoint missing skills and get an upskilling roadmap.</p>
                    <button onClick={() => navigate('/tools')} className="px-4 py-2 rounded-full bg-fuchsia-600 text-white text-sm hover:bg-fuchsia-700">Open</button>
                  </div>
                </div>
                {/* Card 4 */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-5 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 p-[2px] shadow mb-4">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-800">
                        <BadgeDollarSign className="w-7 h-7" />
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">Salary Advisor</div>
                    <p className="text-sm text-gray-600 mt-1 mb-4">Data-driven insights and scripts to negotiate better offers.</p>
                    <button onClick={() => navigate('/tools')} className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm hover:bg-amber-700">Open</button>
                  </div>
                </div>
                {/* Card 5 */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-5 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 p-[2px] shadow mb-4">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-800">
                        <FileText className="w-7 h-7" />
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">Resume & Cover Letter</div>
                    <p className="text-sm text-gray-600 mt-1 mb-4">Generate ATS-friendly resumes and cover letters quickly.</p>
                    <button onClick={() => navigate('/tools')} className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm hover:bg-rose-700">Open</button>
                  </div>
                </div>
                {/* Card 6 */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-5 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-blue-500 p-[2px] shadow mb-4">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-800">
                        <Bot className="w-7 h-7" />
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">24/7 AI Career Mentor</div>
                    <p className="text-sm text-gray-600 mt-1 mb-4">Instant, confidential advice on any career challenge.</p>
                    <button onClick={() => navigate('/tools')} className="px-4 py-2 rounded-full bg-sky-600 text-white text-sm hover:bg-sky-700">Open</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : active === 'priority-support' ? (
        <>
          <div className="max-w-6xl mx-auto mb-3">
            <button onClick={() => setActive(null)} className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Back</button>
          </div>
          <div id="priority-support" className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Priority Support</h2>
            <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.open('tel:+918618536940', '_blank')}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
            >
              Call
            </button>
            <button
              onClick={() => window.open('https://wa.me/918618536940', '_blank')}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Chat with Mentor
            </button>
            </div>
          </div>
        </>
      ) : active === 'groups' ? (
        <>
          <div className="max-w-6xl mx-auto mb-3">
            <button onClick={() => setActive(null)} className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Back</button>
          </div>
          <div id="groups" className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Groups</h2>
            </div>
            <p className="text-sm text-gray-600 mt-2">Browse your premium groups and join discussions.</p>
          </div>
        </>
      ) : active === 'meetings' ? (
        <>
          <div className="max-w-6xl mx-auto mb-3">
            <button onClick={() => setActive(null)} className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Back</button>
          </div>
          <div id="meetings" className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-2">Request a Premium Meeting</h2>
            <p className="text-sm text-gray-600 mb-3">Submit your details to request a meeting. Admin will approve and schedule it.</p>
          {mError && <div className="text-sm text-red-600 mb-2">{mError}</div>}
          <form onSubmit={handleSubmitMeeting} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input
              type="text"
              placeholder="Your name"
              required
              className="border rounded-md px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              type="email"
              placeholder="Your email"
              required
              className="border rounded-md px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Message (optional)"
              className="border rounded-md px-3 py-2 text-sm md:col-span-1"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
            <div className="md:col-span-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={mLoading}
              >
                {mLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>

          <h3 className="font-semibold text-gray-800 mb-2">My Meetings</h3>
          {mLoading ? (
            <div className="text-gray-500 text-sm">Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="text-gray-500 text-sm">No meeting requests yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {meetings.map((mtg) => {
                const canJoin = mtg.status === 'approved' && mtg.scheduledAt ? new Date(mtg.scheduledAt).getTime() <= Date.now() : false;
                const countdown = getCountdown(mtg.scheduledAt);
                return (
                  <li key={mtg._id} className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">{mtg.name} ({mtg.email})</div>
                      <div className="text-xs text-gray-500">Requested: {new Date(mtg.createdAt).toLocaleString()}</div>
                      <div className="text-xs">
                        <span className="mr-2">Status: <span className={mtg.status === 'approved' ? 'text-emerald-600' : mtg.status === 'rejected' ? 'text-red-600' : 'text-gray-600'}>{mtg.status}</span></span>
                        {mtg.scheduledAt && (
                          <span className="text-gray-600">Scheduled: {new Date(mtg.scheduledAt).toLocaleString()} ({countdown})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mtg.status === 'approved' && mtg.meetingLink ? (
                        <button
                          onClick={() => window.open(mtg.meetingLink, '_blank')}
                          className={`inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md ${canJoin ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-200 text-gray-600 cursor-not-allowed'}`}
                        >
                          {canJoin ? 'Join Meeting' : 'Join (available at start time)'}
                        </button>
                      ) : (
                        <button className="px-3 py-1.5 text-sm rounded-md border" disabled>
                          {mtg.status === 'rejected' ? 'Rejected' : 'Awaiting approval'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        </>
      ) : active === 'materials' ? (
        <>
          <div className="max-w-6xl mx-auto mb-3">
            <button onClick={() => setActive(null)} className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Back</button>
          </div>
          <div id="materials" className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Materials</h2>
          {loading ? (
            <div className="text-gray-500">Loading materials...</div>
          ) : error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : materials.length === 0 ? (
            <div className="text-gray-500 text-sm">No materials available yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {materials.map((m) => (
                <li key={m._id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900">{m.name}</div>
                    <div className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(m.mimetype?.startsWith('application/pdf') || m.mimetype?.startsWith('image/')) && (
                      <button
                        onClick={() => {
                          const viewUrl = `${API_URL}/api/v1/materials/${m._id}/view`;
                          setViewerUrl(viewUrl);
                        }}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => window.open(`${API_URL}/api/v1/materials/${m._id}/download`, '_blank')}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Download
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
        </>
      ) : active === 'premium-jobs' ? (
        <>
          <div className="max-w-6xl mx-auto mb-3">
            <button onClick={() => setActive(null)} className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Back</button>
          </div>
          <div id="premium-jobs" className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Premium Jobs</h2>
            {jLoading && <div className="text-gray-500 text-sm">Loading jobs...</div>}
            {jError && <div className="text-red-600 text-sm">{jError}</div>}
            {!jLoading && !jError && jobs.length === 0 && (
              <div className="text-gray-500 text-sm">No jobs available yet.</div>
            )}
            {!jLoading && !jError && jobs.length > 0 && (
              <div className="grid grid-cols-1 gap-6">
                {jobs.map((job: any) => (
                  <div key={job._id} className="group bg-gray-50 rounded-xl shadow border border-gray-200 hover:border-blue-200 transition">
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600">{job.title}</h3>
                          <div className="text-gray-700 font-medium mt-1">{job.company}</div>
                          <div className="mt-2 text-sm text-gray-600">
                            {job.location && <span className="mr-3">{job.location}</span>}
                            {job.type && <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">{job.type}</span>}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <a
                            href={job.applicationUrl || '#'}
                            target={job.applicationUrl ? '_blank' : undefined}
                            rel="noreferrer"
                            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                          >
                            View & Apply
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>

    {/* PDF Viewer Modal */}
    {viewerUrl && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setViewerUrl(null)} />
        <div className="relative z-10 w-[95vw] h-[90vh] md:w-[80vw] md:h-[85vh] bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <div className="text-sm text-gray-600">PDF Viewer</div>
            <div className="flex items-center gap-3">
              <a
                href={viewerUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Open in new tab
              </a>
              <button
                onClick={() => setViewerUrl(null)}
                className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
          <iframe title="PDF Viewer" src={viewerUrl || ''} className="w-full h-full" />
        </div>
      </div>
    )}
    </>
  );

};

export default PremiumPage;
