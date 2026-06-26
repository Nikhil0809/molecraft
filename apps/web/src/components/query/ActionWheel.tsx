"use client";

import styles from "./ActionWheel.module.css";

interface Action {
  id: string;
  label: string;
  icon: string;
  action: () => void;
}

interface ActionWheelProps {
  actions: Action[];
  visible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

export function ActionWheel({ actions, visible, position, onClose }: ActionWheelProps) {
  if (!visible) return null;

  const radius = 80;
  const angleStep = (2 * Math.PI) / actions.length;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div
        className={styles.wheel}
        style={{ left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.centerDot} />
        {actions.map((action, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <button
              key={action.id}
              className={styles.action}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                action.action();
                onClose();
              }}
            >
              <span className={styles.actionIcon}>{action.icon}</span>
              <span className={styles.actionLabel}>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
