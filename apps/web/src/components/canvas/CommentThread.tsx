"use client";

import { useState } from "react";
import styles from "./CommentThread.module.css";

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

interface CommentThreadProps {
  moleculeName: string;
}

export function CommentThread({ moleculeName }: CommentThreadProps) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  const handleAdd = () => {
    if (!newComment.trim()) return;
    setComments((prev) => [
      ...prev,
      { id: `c${Date.now()}`, author: "You", text: newComment.trim(), timestamp: Date.now() },
    ]);
    setNewComment("");
  };

  const count = comments.length;

  return (
    <div className={styles.container}>
      <button className={styles.toggle} onClick={() => setExpanded(!expanded)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7C3 4.79086 4.79086 3 7 3C9.20914 3 11 4.79086 11 7C11 9.20914 9.20914 11 7 11C6.5 11 5.5 10.8 4.5 11L3 12.5V7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
        {count > 0 && <span className={styles.count}>{count}</span>}
      </button>

      {expanded && (
        <div className={styles.thread}>
          <div className={styles.header}>
            <span className={styles.title}>Comments — {moleculeName}</span>
            <button className={styles.closeBtn} onClick={() => setExpanded(false)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className={styles.list}>
            {comments.length === 0 && (
              <p className={styles.empty}>No comments yet. Add one below.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className={styles.comment}>
                <span className={styles.author}>{c.author}</span>
                <p className={styles.text}>{c.text}</p>
              </div>
            ))}
          </div>
          <div className={styles.inputArea}>
            <input
              className={styles.input}
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <button className={styles.sendBtn} onClick={handleAdd} disabled={!newComment.trim()}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L10 2L8 6L10 10L2 6Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
