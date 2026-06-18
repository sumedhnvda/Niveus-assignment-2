import { auth } from '@/lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://niveus-assignment-2.vercel.app/api';

class ApiClient {
  constructor() {
    this.token = null;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  getUser() {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    }
    return null;
  }

  setUser(user) {
    if (typeof window !== 'undefined') localStorage.setItem('user', JSON.stringify(user));
  }

  /**
   * Refresh Firebase token to prevent "not authenticated" errors.
   * Firebase ID tokens expire after 1 hour; this ensures we always have a fresh one.
   */
  async refreshToken() {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const freshToken = await currentUser.getIdToken(true);
        this.setToken(freshToken);
        return freshToken;
      }
    } catch (e) {
      console.warn('Token refresh failed:', e);
    }
    return null;
  }

  async request(path, options = {}, retried = false) {
    const headers = { ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // If 401, try refreshing the Firebase token once
    if (response.status === 401 && !retried) {
      const newToken = await this.refreshToken();
      if (newToken) {
        return this.request(path, options, true);
      }
      this.clearToken();
      if (typeof window !== 'undefined') window.location.href = '/';
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }
    return response;
  }

  async loginWithFirebase(firebaseToken) {
    this.setToken(firebaseToken);
    const res = await this.request('/auth/me');
    const data = await res.json();
    this.setUser(data);
    return data;
  }

  async getMe() { return (await this.request('/auth/me')).json(); }
  async getUsers() { return (await this.request('/auth/users')).json(); }
  async flagUser(userId, isFlagged, reason = null) { return (await this.request(`/auth/users/${userId}/flag`, { method: 'PUT', body: JSON.stringify({ is_flagged: isFlagged, flag_reason: reason }) })).json(); }
  async toggleUserActive(userId) { return (await this.request(`/auth/users/${userId}/toggle-active`, { method: 'PUT' })).json(); }
  async makeAdmin(userId) { return (await this.request(`/auth/users/${userId}/make-admin`, { method: 'PUT' })).json(); }

  // Books
  async getBooks(search = null, genre = null) {
    const p = new URLSearchParams();
    if (search) p.append('search', search);
    if (genre) p.append('genre', genre);
    const q = p.toString() ? `?${p}` : '';
    return (await this.request(`/books/${q}`)).json();
  }
  async getBook(id) { return (await this.request(`/books/${id}`)).json(); }
  async createBook(data) { return (await this.request('/books/', { method: 'POST', body: JSON.stringify(data) })).json(); }
  async updateBook(id, data) { return (await this.request(`/books/${id}`, { method: 'PUT', body: JSON.stringify(data) })).json(); }
  async deleteBook(id) { return (await this.request(`/books/${id}`, { method: 'DELETE' })).json(); }
  async uploadBookPdf(bookId, file) {
    const fd = new FormData(); fd.append('file', file);
    return (await this.request(`/books/${bookId}/upload-pdf`, { method: 'POST', body: fd })).json();
  }
  getBookPdfUrl(bookId) { return `${API_BASE}/books/${bookId}/pdf`; }
  async getBookSummary(bookId) { return (await this.request(`/books/${bookId}/summary`)).json(); }
  async getBookAnalytics() { return (await this.request('/books/analytics/popular')).json(); }

  // AI-generate book description
  async generateBookDescription(title, author) {
    return (await this.request('/books/generate-description', {
      method: 'POST',
      body: JSON.stringify({ title, author }),
    })).json();
  }

  // AI-extract metadata from PDF
  async extractBookMetadata(file) {
    const fd = new FormData();
    fd.append('file', file);
    return (await this.request('/books/extract-metadata', { method: 'POST', body: fd })).json();
  }

  // Chat
  async sendMessage(message, sessionId = null, bookId = null) { return (await this.request('/chat/', { method: 'POST', body: JSON.stringify({ message, session_id: sessionId, book_id: bookId }) })).json(); }
  async summarizeBook(bookId) { return (await this.request(`/chat/summarize/${bookId}`, { method: 'POST' })).json(); }
  async quizBook(bookId) { return (await this.request(`/chat/quiz/${bookId}`, { method: 'POST' })).json(); }
  async getChatSessions(bookId = null) { return (await this.request(`/chat/sessions${bookId ? `?book_id=${bookId}` : ''}`)).json(); }
  async getSessionMessages(sessionId) { return (await this.request(`/chat/sessions/${sessionId}/messages`)).json(); }
  async deleteSession(sessionId) { return (await this.request(`/chat/sessions/${sessionId}`, { method: 'DELETE' })).json(); }

  // Analytics
  async getAnalyticsSummary(days = 30) { return (await this.request(`/analytics/summary?days=${days}`)).json(); }
  async getLLMUsage(agent = null, userId = null, limit = 100) {
    const p = new URLSearchParams(); if (agent) p.append('agent_name', agent); if (userId) p.append('user_id', userId); p.append('limit', limit);
    return (await this.request(`/analytics/llm-usage?${p}`)).json();
  }
  async getBookRequests(status = null) { return (await this.request(`/analytics/book-requests${status ? `?status=${status}` : ''}`)).json(); }
  async updateBookRequest(id, status, notes = null) { return (await this.request(`/analytics/book-requests/${id}`, { method: 'PUT', body: JSON.stringify({ status, admin_notes: notes }) })).json(); }
  async getModerationLogs(severity = null, userId = null) {
    const p = new URLSearchParams(); if (severity) p.append('severity', severity); if (userId) p.append('user_id', userId);
    return (await this.request(`/analytics/moderation?${p}`)).json();
  }
  async reviewModerationLog(id) { return (await this.request(`/analytics/moderation/${id}/review`, { method: 'PUT' })).json(); }

  /**
   * Fetch PDF as blob with auth header (for modern PDF viewer).
   */
  async getBookPdfBlob(bookId) {
    const response = await this.request(`/books/${bookId}/pdf`);
    return response.blob();
  }
}

const api = new ApiClient();
export default api;
