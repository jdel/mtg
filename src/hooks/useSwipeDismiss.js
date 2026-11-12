import { useRef, useState } from "react";

const SWIPE_CLOSE_THRESHOLD = 80;

export default function useSwipeDismiss(onDismiss, canStart = () => true) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);

  function resetDrag() {
    dragStart.current = null;
    setDragY(0);
    setIsDragging(false);
  }

  return {
    dragY,
    isDragging,
    resetDrag,
    swipeHandlers: {
      onPointerCancel: resetDrag,
      onPointerDown(event) {
        if (event.pointerType === "mouse" || !canStart(event)) return;
        dragStart.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event) {
        if (!dragStart.current) return;

        const distanceX = event.clientX - dragStart.current.x;
        const distanceY = event.clientY - dragStart.current.y;
        if (distanceY <= 0 || Math.abs(distanceX) >= distanceY) return;
        setDragY(distanceY);
        setIsDragging(true);
      },
      onPointerUp(event) {
        if (!dragStart.current) return;

        const distanceX = event.clientX - dragStart.current.x;
        const distanceY = event.clientY - dragStart.current.y;
        dragStart.current = null;
        if (distanceY >= SWIPE_CLOSE_THRESHOLD && distanceY > Math.abs(distanceX)) {
          onDismiss();
        } else {
          setDragY(0);
          setIsDragging(false);
        }
      },
    },
  };
}
