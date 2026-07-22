import { useRef, useEffect } from 'react';

/* ── Drag handle component for panel resizing ── */
export function ResizeHandle({
  onResize,
  onResizeStart,
  onResizeEnd,
}: {
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeEnd?.();
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isDragging.current) {
        onResizeEnd?.();
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onResize, onResizeEnd]);

  return (
    <div
      className="relative w-[5px] shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-blue-500/30 active:bg-blue-500/50 group"
      onMouseDown={(e) => {
        onResizeStart?.();
        isDragging.current = true;
        lastX.current = e.clientX;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }}
    >
      {/* Vertical dots indicator */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-[3px]">
        <div className="w-[2px] h-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="w-[2px] h-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="w-[2px] h-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="w-[2px] h-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="w-[2px] h-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
      </div>
      {/* Thin vertical line that appears on hover */}
      <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-0 group-hover:w-[1.5px] bg-blue-400/60 transition-all duration-150 rounded-full" />
    </div>
  );
}

/* ── Drag handle for vertical panel resizing (timeline) ── */
export function VerticalResizeHandle({
  onResize,
  onResizeStart,
  onResizeEnd,
}: {
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}) {
  const isDragging = useRef(false);
  const lastY = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // Negative delta = dragging up = making panel taller
      const delta = lastY.current - e.clientY;
      lastY.current = e.clientY;
      onResize(delta);
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeEnd?.();
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isDragging.current) {
        onResizeEnd?.();
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onResize, onResizeEnd]);

  return (
    <div
      className="relative h-[5px] shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-blue-500/30 active:bg-blue-500/50 group"
      onMouseDown={(e) => {
        onResizeStart?.();
        isDragging.current = true;
        lastY.current = e.clientY;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }}
    >
      {/* Horizontal dots indicator */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-[3px]">
        <div className="h-[2px] w-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="h-[2px] w-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="h-[2px] w-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="h-[2px] w-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
        <div className="h-[2px] w-[2px] rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
      </div>
      {/* Thin horizontal line that appears on hover */}
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0 group-hover:h-[1.5px] bg-blue-400/60 transition-all duration-150 rounded-full" />
    </div>
  );
}
