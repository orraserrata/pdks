import React from "react";

export default function LoadingSpinner({ className = "" }) {
  return (
    <div className={`loader-wrap${className ? ` ${className}` : ""}`}>
      <div className="loader" aria-label="Yükleniyor" role="status" />
    </div>
  );
}
