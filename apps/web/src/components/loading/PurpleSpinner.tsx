"use client";

interface PurpleSpinnerProps {
  size?: number;
  text?: string;
  subtext?: string;
}

export function PurpleSpinner({ size = 48, text, subtext }: PurpleSpinnerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "64px 24px" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid rgba(139, 92, 246, 0.2)`,
          borderTopColor: "#8B5CF6",
          borderRightColor: "#A78BFA",
          animation: "opencodePurpleSpin 0.8s linear infinite",
          boxShadow: "0 0 20px rgba(139, 92, 246, 0.15)",
        }}
      />
      {text && (
        <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#f8fafc", margin: 0, textAlign: "center" }}>
          {text}
        </p>
      )}
      {subtext && (
        <span style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "center" }}>
          {subtext}
        </span>
      )}
      <style>{`
        @keyframes opencodePurpleSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
