export type NaukriJob = {
  id?: string;
  title: string;
  company?: string;
  location?: string;
  snippet?: string;
  link?: string; // application URL
  salary?: string;
  updated?: string;
  type?: string;
};

// This service hits an n8n webhook or HTTP node that returns jobs.
// Configure the endpoint in .env as VITE_NAUKRI_N8N_URL
// Expected response: { jobs: NaukriJob[] } | NaukriJob[]
export const naukriService = {
  getJobs: async (params: { keywords?: string; location?: string; page?: number; limit?: number } = {}): Promise<NaukriJob[]> => {
    try {
      // Use backend proxy to avoid exposing secrets and to bypass CORS.
      // Prefer explicit env override, then current origin (covers SSR/preview), then production API.
      const apiBase = (import.meta as any)?.env?.VITE_API_BASE
        || (typeof window !== 'undefined' && window.location?.origin)
        || (import.meta as any)?.env?.VITE_API_URL
        || 'https://www.careerredefine.com';
      const url = new URL('/api/v1/external/naukri', apiBase);
      if (params.keywords) url.searchParams.set('keywords', params.keywords);
      if (params.location) url.searchParams.set('location', params.location);
      if (params.page) url.searchParams.set('page', String(params.page));
      if (params.limit) url.searchParams.set('limit', String(params.limit));

      const resp = await fetch(url.toString(), { method: 'GET' });
      if (!resp.ok) return [];
      const data = await resp.json();
      if (Array.isArray(data)) return data as NaukriJob[];
      if (Array.isArray(data?.jobs)) return data.jobs as NaukriJob[];
      // try a typical n8n execution format
      if (Array.isArray(data?.data)) return data.data as NaukriJob[];
      return [];
    } catch (e) {
      console.error('Failed to load Naukri jobs via n8n', e);
      return [];
    }
  }
};
