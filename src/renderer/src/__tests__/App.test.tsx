import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

// Mock the API client — settingsApi.getAppStatus() returns fully configured
vi.mock('../api/client', () => ({
  settingsApi: {
    getAppStatus: vi.fn().mockResolvedValue({
      success: true,
      data: { llmConfigured: true, projectsDirConfigured: true, projectsDir: '/tmp/test-projects' },
    }),
    getProjectsDir: vi.fn().mockResolvedValue({
      success: true,
      data: { configured: true, path: '/tmp/test-projects' },
    }),
    setProjectsDir: vi.fn().mockResolvedValue({ success: true }),
  },
  projectApi: {
    getBook: vi.fn().mockResolvedValue({ data: null }),
    listBooks: vi.fn().mockResolvedValue({ data: [] }),
    createBook: vi.fn().mockResolvedValue({ data: { id: 'test', title: 'Test' } }),
    updateBook: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue({ data: [] }),
  },
  aiApi: {
    getStatus: vi.fn().mockResolvedValue({ success: false }),
    configure: vi.fn().mockResolvedValue({}),
    getProviders: vi.fn().mockResolvedValue({ data: [] }),
    addProvider: vi.fn().mockResolvedValue({}),
    updateProvider: vi.fn().mockResolvedValue({}),
    deleteProvider: vi.fn().mockResolvedValue({}),
    setActive: vi.fn().mockResolvedValue({}),
    discoverModels: vi.fn().mockResolvedValue({ success: false }),
  },
  sessionApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    get: vi.fn().mockResolvedValue({ data: null }),
    create: vi.fn().mockResolvedValue({ data: { id: 'test' } }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    migrate: vi.fn().mockResolvedValue({}),
  },
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // App starts in loading state (returns null), then transitions to projects view
    // Just verify it mounts without error
  });

  it('transitions to projects view after app-status check', async () => {
    render(<App />);
    // After app-status returns fully configured, should show projects view
    await waitFor(() => {
      expect(screen.getByText('Hallucinated Talles')).toBeDefined();
    });
  });
});
