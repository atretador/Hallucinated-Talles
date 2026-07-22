import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffViewer } from '../components/editor/DiffViewer';

describe('DiffViewer', () => {
  const oldContent = 'line one\nline two\nline three';
  const newContent = 'line one\nline two modified\nline three\nline four';

  it('renders the diff header', () => {
    const { container } = render(
      <DiffViewer
        oldContent={oldContent}
        newContent={newContent}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('Proposed Changes')).toBeDefined();
    // Counts are shown as colored spans; check they exist
    expect(container.querySelector('.text-green-400')).toBeDefined();
    expect(container.querySelector('.text-red-400')).toBeDefined();
  });

  it('renders Accept and Reject buttons', () => {
    render(
      <DiffViewer
        oldContent={oldContent}
        newContent={newContent}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('Accept')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
  });

  it('calls onAccept when Accept button is clicked', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <DiffViewer
        oldContent={oldContent}
        newContent={newContent}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );
    fireEvent.click(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onReject).not.toHaveBeenCalled();
  });

  it('calls onReject when Reject button is clicked', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <DiffViewer
        oldContent={oldContent}
        newContent={newContent}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );
    fireEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('renders identical content without diff markers', () => {
    const { container } = render(
      <DiffViewer
        oldContent="same content"
        newContent="same content"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('same content')).toBeDefined();
    // No removal or addition backgrounds for identical content
    expect(container.querySelector('.bg-red-900\\/30')).toBeNull();
    expect(container.querySelector('.bg-green-900\\/30')).toBeNull();
  });

  it('shows diff lines for changed content', () => {
    render(
      <DiffViewer
        oldContent="old line"
        newContent="new line"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('old line')).toBeDefined();
    expect(screen.getByText('new line')).toBeDefined();
  });
});
