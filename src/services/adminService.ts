import api from '../utils/api';
import axios from 'axios';

interface DashboardStats {
  users: number;
  jobs: number;
  courses: number;
  awards: number;
  articles: number;
  queries: number;
  questions: number;
  appointments: number;
  reviews: number;
  recentUsers: any[];
  recentQueries: any[];
  recentQuestions: any[];
  recentAppointments: any[];
}

export const adminService = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    try {
      const response = await api.get('/api/v1/admin/dashboard/stats');
      // Backend shape: { status, data: { ...stats } }
      return response.data?.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  // Brands (Accreditations & Partners)
  getBrands: async (page = 1, limit = 50) => {
    const response = await api.get(`/api/v1/brands?page=${page}&limit=${limit}`);
    return response.data?.data; // { brands }
  },

  createBrand: async (payload: any) => {
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await api.post('/api/v1/brands', payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return response.data?.data; // { brand }
  },

  createReview: async (payload: { course: string; rating: number; comment?: string }) => {
    // Note: backend requires the user to be enrolled in the course
    const response = await api.post('/api/v1/reviews', payload);
    return response.data;
  },
  
  // Add more admin service methods as needed
  getUsers: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/v1/admin/users?page=${page}&limit=${limit}`);
    return response.data?.data; // { users }
  },
  
  getJobs: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/v1/jobs?page=${page}&limit=${limit}`);
    return response.data?.data; // { jobs }
  },
  
  getCourses: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/v1/courses?page=${page}&limit=${limit}`);
    return response.data?.data; // { courses }
  },
  
  getAwards: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/v1/awards?page=${page}&limit=${limit}`);
    return response.data?.data; // { awards }
  },
  createAward: async (payload: any) => {
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await api.post('/api/v1/awards', payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return response.data?.data; // { award }
  },
  
  getArticles: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/v1/articles?page=${page}&limit=${limit}`);
    return response.data?.data; // { articles }
  },
  
  getQueries: async (page = 1, limit = 10) => {
    // Admin list endpoint (admin-only route at GET /api/v1/queries)
    const response = await api.get(`/api/v1/queries?page=${page}&limit=${limit}`);
    return response.data?.data; // { queries }
  },

  replyToQuery: async (queryId: string, reply: string) => {
    const response = await api.post(`/api/v1/queries/${queryId}/reply`, { reply });
    return response.data?.data; // { query }
  },

  getQuestions: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/v1/questions?page=${page}&limit=${limit}`);
    return response.data?.data; // { questions }
  },
  
  getAppointments: async (page = 1, limit = 10) => {
    // Appointments are implemented as bookings; admin list is at /api/v1/bookings
    const response = await api.get(`/api/v1/bookings?page=${page}&limit=${limit}`);
    return response.data?.data; // { bookings }
  },

  // Resumes (admin)
  getResumes: async (page = 1, limit = 50) => {
    // Backend returns { status, results, data: { resumes } }
    const response = await api.get(`/api/v1/resume?page=${page}&limit=${limit}`);
    return response.data?.data; // { resumes }
  },

  // Resume by ID (admin or owner)
  getResumeById: async (id: string) => {
    const response = await api.get(`/api/v1/resume/${id}`);
    return response.data?.data; // { resume }
  },

  // Resumes (current user)
  getMyResumes: async () => {
    const response = await api.get('/api/v1/resume/mine');
    return response.data?.data; // { resumes }
  },
  
  updateBookingStatus: async (
    id: string,
    payload: { status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed'; meetingLink?: string; message?: string; adminNotes?: string }
  ) => {
    const response = await api.patch(`/api/v1/bookings/${id}`, payload);
    return response.data;
  },
  
  getReviews: async (page = 1, limit = 10) => {
    // Prefer admin endpoint for complete access
    const response = await api.get(`/api/v1/reviews/admin/all?page=${page}&limit=${limit}`);
    return response.data?.data; // { reviews }
  },

  getBookings: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/v1/bookings?page=${page}&limit=${limit}`);
    return response.data?.data; // { bookings }
  },

  // Deletes
  deleteUser: async (userId: string) => {
    const response = await api.delete(`/api/v1/admin/users/${userId}`);
    return response.data;
  },

  deleteQuery: async (queryId: string) => {
    const response = await api.delete(`/api/v1/queries/${queryId}`);
    return response.data;
  },

  deleteQuestion: async (questionId: string) => {
    const response = await api.delete(`/api/v1/questions/${questionId}`);
    return response.data;
  },

  deleteJob: async (jobId: string) => {
    const response = await api.delete(`/api/v1/jobs/${jobId}`);
    return response.data;
  },

  deleteCourse: async (courseId: string) => {
    const response = await api.delete(`/api/v1/courses/${courseId}`);
    return response.data;
  },

  deleteArticle: async (articleId: string) => {
    const response = await api.delete(`/api/v1/articles/${articleId}`);
    return response.data;
  },

  deleteAward: async (awardId: string) => {
    const response = await api.delete(`/api/v1/awards/${awardId}`);
    return response.data;
  },

  deleteBrand: async (brandId: string) => {
    const response = await api.delete(`/api/v1/brands/${brandId}`);
    return response.data;
  },

  deleteReview: async (reviewId: string) => {
    const response = await api.delete(`/api/v1/reviews/${reviewId}`);
    return response.data;
  },

  deleteBooking: async (bookingId: string) => {
    // Use admin hard-delete endpoint to avoid interfering with existing workflows
    const response = await api.delete(`/api/v1/bookings/${bookingId}/hard-delete`);
    return response.data;
  },

  // Premium Users (admin)
  listPremiumUsers: async () => {
    const response = await api.get('/api/v1/admin/premium-users');
    return response.data?.data; // { users }
  },

  createPremiumUser: async (payload: { name?: string; email: string; password: string; }) => {
    const response = await api.post('/api/v1/admin/premium-users', payload);
    return response.data?.data; // { user }
  },

  setPremiumStatus: async (id: string, isPremium: boolean) => {
    const response = await api.patch(`/api/v1/admin/premium-users/${id}`, { isPremium });
    return response.data?.data; // { user }
  },

  deleteResume: async (resumeId: string) => {
    const response = await api.delete(`/api/v1/resume/${resumeId}`);
    return response.data;
  },

  confirmBooking: async (bookingId: string, meetingLink: string) => {
    const response = await api.patch(`/api/v1/bookings/${bookingId}`, {
      status: 'confirmed',
      meetingLink,
    });
    return response.data?.data; // { booking }
  },

  // Materials (admin)
  listMaterials: async () => {
    const response = await api.get('/api/v1/materials');
    return response.data?.data; // { materials } (requires premium/admin; admin is allowed)
  },

  uploadMaterial: async (payload: { name?: string; file: File }) => {
    const form = new FormData();
    if (payload.name) form.append('name', payload.name);
    form.append('file', payload.file);
    const response = await api.post('/api/v1/materials', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data; // { material }
  },

  deleteMaterial: async (id: string) => {
    const response = await api.delete(`/api/v1/materials/${id}`);
    return response.data;
  },

  // Creates (for inline forms)
  createQuery: async (payload: { subject: string; message: string; name?: string; email?: string; phone?: string; course?: string }) => {
    const response = await api.post('/api/v1/queries', payload);
    return response.data?.data; // { query }
  },

  createQuestion: async (payload: { subject?: string; message: string; name: string; email: string; phone?: string }) => {
    // Public questions endpoint (no auth). Use absolute URL to bypass interceptors/tokens.
    const response = await axios.post('https://www.careerredefine.com/api/v1/questions', payload, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: false,
    });
    return (response.data as any)?.data; // { question }
  },

  createArticle: async (payload: any) => {
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await api.post('/api/v1/articles', payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return response.data?.data; // { article }
  },

  createJob: async (payload: any) => {
    // If FormData is used (e.g., with logo), send as multipart
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await api.post('/api/v1/jobs', payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return response.data?.data; // { job }
  },

  createCourse: async (payload: any) => {
    // Use multipart when FormData is passed to include image/syllabus
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await api.post('/api/v1/courses', payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return response.data?.data; // { course }
  },

  createBooking: async (payload: { name: string; email: string; phone: string; date: string; timeSlot: string; type?: string; message?: string }) => {
    // Public bookings endpoint (no auth). Use absolute URL to bypass interceptors/tokens.
    const response = await axios.post('https://www.careerredefine.com/api/v1/bookings', payload, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: false,
    });
    return (response.data as any)?.data; // { booking }
  },

  // Champions
  getChampions: async (page = 1, limit = 50) => {
    const response = await api.get(`/api/v1/champions?page=${page}&limit=${limit}`);
    return response.data?.data; // { champions }
  },

  createChampion: async (payload: any) => {
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await api.post('/api/v1/champions', payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return response.data?.data; // { champion }
  },

  deleteChampion: async (championId: string) => {
    const response = await api.delete(`/api/v1/champions/${championId}`);
    return response.data;
  },

  // Mentors
  getMentors: async (page = 1, limit = 50) => {
    const response = await api.get(`/api/v1/mentors?page=${page}&limit=${limit}`);
    return response.data?.data; // { mentors }
  },

  createMentor: async (payload: any) => {
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    const response = await api.post('/api/v1/mentors', payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    return response.data?.data; // { mentor }
  },

  deleteMentor: async (mentorId: string) => {
    const response = await api.delete(`/api/v1/mentors/${mentorId}`);
    return response.data;
  }
};
