import type {
  AuthResponse,
  DashboardStatsDto,
  LessonItemDto,
  ReviewQueueItemDto,
  SubmitReviewRequest,
  SubmitReviewResponse,
  SubjectDetailDto,
  SubjectSummaryDto,
  SubjectType
} from '../types';

const API_BASE = '/api';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('kotoba_token');
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('kotoba_token', token);
  } else {
    localStorage.removeItem('kotoba_token');
  }
};

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errJson = await response.json();
      errorMsg = errJson.message || errJson.errors?.[0] || response.statusText;
    } catch {
      errorMsg = response.statusText;
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      fetchWithAuth<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      fetchWithAuth<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () =>
      fetchWithAuth<{ userId: number; username: string; email: string; isAdmin: boolean }>('/auth/me'),
  },

  dashboard: {
    getStats: () => fetchWithAuth<DashboardStatsDto>('/dashboard'),
    getAdminStats: () => fetchWithAuth<import('../types').AdminDeckStats>('/dashboard/admin'),
  },

  subjects: {
    list: (params?: { type?: SubjectType; level?: number }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set('type', params.type);
      if (params?.level) q.set('level', params.level.toString());
      return fetchWithAuth<SubjectSummaryDto[]>(`/subjects?${q.toString()}`);
    },
    getDetail: (id: number) => fetchWithAuth<SubjectDetailDto>(`/subjects/${id}`),
    create: (data: import('../types').CreateSubjectInput) =>
      fetchWithAuth<SubjectDetailDto>('/subjects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: import('../types').UpdateSubjectInput) =>
      fetchWithAuth<SubjectDetailDto>(`/subjects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchWithAuth<{ success: boolean; message: string }>(`/subjects/${id}`, {
        method: 'DELETE',
      }),
    deleteLevel: (level: number) =>
      fetchWithAuth<import('../types').ResetLevelResult>(`/subjects/level/${level}`, {
        method: 'DELETE',
      }),
    quickGenerate: (data: { character: string; type: SubjectType; level: number }) =>
      fetchWithAuth<any>('/subjects/quick-generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  lessons: {
    getAvailable: (limit = 10) =>
      fetchWithAuth<LessonItemDto[]>(`/lessons/available?limit=${limit}`),
    complete: (subjectId: number) =>
      fetchWithAuth<{ success: boolean; message: string }>(`/lessons/${subjectId}/complete`, {
        method: 'POST',
      }),
  },

  reviews: {
    getQueue: (limit = 50) =>
      fetchWithAuth<ReviewQueueItemDto[]>(`/reviews/queue?limit=${limit}`),
    getForecast: () =>
      fetchWithAuth<import('../types').ReviewForecast>('/reviews/forecast'),
    submit: (data: SubmitReviewRequest) =>
      fetchWithAuth<SubmitReviewResponse>('/reviews/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  ai: {
    generate: (data: { type: SubjectType; character: string; level: number }) =>
      fetchWithAuth<any>('/ai/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    generateLevel: (data: {
      level: number;
      theme?: string;
      radicalCount?: number;
      kanjiCount?: number;
      vocabCount?: number;
    }) =>
      fetchWithAuth<import('../types').LevelGenerationResultDto>('/ai/generate-level', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resetLevel: (level: number) =>
      fetchWithAuth<import('../types').ResetLevelResult>(`/ai/reset-level/${level}`, {
        method: 'POST',
      }),
    getPending: () => fetchWithAuth<import('../types').AiPendingItem[]>('/ai/pending'),
    approve: (id: number) =>
      fetchWithAuth<{ success: boolean; message: string }>(`/ai/approve/${id}`, {
        method: 'POST',
      }),
    approveAll: (type?: SubjectType) => {
      const q = type ? `?type=${type}` : '';
      return fetchWithAuth<import('../types').BulkActionResponse>(`/ai/approve-all${q}`, {
        method: 'POST',
      });
    },
    reject: (id: number, reason?: string) =>
      fetchWithAuth<{ success: boolean; message: string }>(`/ai/reject/${id}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    rejectAll: (type?: SubjectType, reason?: string) => {
      const q = type ? `?type=${type}` : '';
      return fetchWithAuth<import('../types').BulkActionResponse>(`/ai/reject-all${q}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    edit: (id: number, parsedContentJson: string) =>
      fetchWithAuth<{ success: boolean; message: string }>(`/ai/edit/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ parsedContentJson }),
      }),
    refine: (id: number, instruction: string) =>
      fetchWithAuth<any>(`/ai/refine/${id}`, {
        method: 'POST',
        body: JSON.stringify({ instruction }),
      }),
  },

  admin: {
    getLogs: (params?: { limit?: number; level?: string; category?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', params.limit.toString());
      if (params?.level && params.level !== 'ALL') q.set('level', params.level);
      if (params?.category && params.category !== 'ALL') q.set('category', params.category);
      if (params?.search) q.set('search', params.search);
      return fetchWithAuth<import('../types').SystemLogEntry[]>(`/admin/logs?${q.toString()}`);
    },
    clearLogs: () =>
      fetchWithAuth<{ success: boolean; message: string }>('/admin/logs/clear', {
        method: 'POST',
      }),
  },
};
