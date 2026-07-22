import { useState, useRef, useCallback } from 'react';

export function useResizePanels() {
  // Resizable panel widths (defaults match original fixed sizes)
  const [leftWidth, setLeftWidth] = useState(288);
  const [rightWidth, setRightWidth] = useState(320);

  // Refs for performant resize (direct DOM manipulation, no React re-renders during drag)
  const leftWidthRef = useRef(288);
  const rightWidthRef = useRef(320);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  // Resizable timeline height (default matches original fixed 192px)
  const [timelineHeight, setTimelineHeight] = useState(192);
  const timelineHeightRef = useRef(192);
  const timelinePanelRef = useRef<HTMLDivElement>(null);

  // Resizable chapter tree width (default 224px = w-56)
  const [treeWidth, setTreeWidth] = useState(224);
  const treeWidthRef = useRef(224);
  const treePanelRef = useRef<HTMLDivElement>(null);

  const handleLeftResize = useCallback((delta: number) => {
    leftWidthRef.current = Math.max(200, Math.min(500, leftWidthRef.current + delta));
    if (leftPanelRef.current) {
      leftPanelRef.current.style.width = `${leftWidthRef.current}px`;
    }
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    rightWidthRef.current = Math.max(320, rightWidthRef.current - delta);
    if (rightPanelRef.current) {
      rightPanelRef.current.style.width = `${rightWidthRef.current}px`;
    }
  }, []);

  const handleLeftResizeStart = useCallback(() => {
    isResizingRef.current = true;
    if (leftPanelRef.current) {
      leftPanelRef.current.style.transition = 'none';
    }
  }, []);

  const handleLeftResizeEnd = useCallback(() => {
    isResizingRef.current = false;
    if (leftPanelRef.current) {
      leftPanelRef.current.style.transition = '';
    }
    setLeftWidth(leftWidthRef.current);
  }, []);

  const handleRightResizeStart = useCallback(() => {
    isResizingRef.current = true;
    if (rightPanelRef.current) {
      rightPanelRef.current.style.transition = 'none';
    }
  }, []);

  const handleRightResizeEnd = useCallback(() => {
    isResizingRef.current = false;
    if (rightPanelRef.current) {
      rightPanelRef.current.style.transition = '';
    }
    setRightWidth(rightWidthRef.current);
  }, []);

  const handleTimelineResize = useCallback((delta: number) => {
    timelineHeightRef.current = Math.max(96, Math.min(600, timelineHeightRef.current + delta));
    if (timelinePanelRef.current) {
      timelinePanelRef.current.style.height = `${timelineHeightRef.current}px`;
    }
  }, []);

  const handleTimelineResizeStart = useCallback(() => {
    isResizingRef.current = true;
    if (timelinePanelRef.current) {
      timelinePanelRef.current.style.transition = 'none';
    }
  }, []);

  const handleTimelineResizeEnd = useCallback(() => {
    isResizingRef.current = false;
    if (timelinePanelRef.current) {
      timelinePanelRef.current.style.transition = '';
    }
    setTimelineHeight(timelineHeightRef.current);
  }, []);

  const handleTreeResize = useCallback((delta: number) => {
    treeWidthRef.current = Math.max(140, Math.min(500, treeWidthRef.current + delta));
    if (treePanelRef.current) {
      treePanelRef.current.style.width = `${treeWidthRef.current}px`;
    }
  }, []);

  const handleTreeResizeStart = useCallback(() => {
    isResizingRef.current = true;
    if (treePanelRef.current) {
      treePanelRef.current.style.transition = 'none';
    }
  }, []);

  const handleTreeResizeEnd = useCallback(() => {
    isResizingRef.current = false;
    if (treePanelRef.current) {
      treePanelRef.current.style.transition = '';
    }
    setTreeWidth(treeWidthRef.current);
  }, []);

  return {
    leftWidth,
    rightWidth,
    leftPanelRef,
    rightPanelRef,
    timelineHeight,
    timelinePanelRef,
    treeWidth,
    treePanelRef,
    isResizingRef,
    handleLeftResize,
    handleRightResize,
    handleLeftResizeStart,
    handleLeftResizeEnd,
    handleRightResizeStart,
    handleRightResizeEnd,
    handleTimelineResize,
    handleTimelineResizeStart,
    handleTimelineResizeEnd,
    handleTreeResize,
    handleTreeResizeStart,
    handleTreeResizeEnd,
  };
}
