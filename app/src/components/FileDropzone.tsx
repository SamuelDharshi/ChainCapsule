"use client";
import { useCallback, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  accept?: string;
}

export default function FileDropzone({ onFile, accept }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setSelected(file); onFile(file); }
  }, [onFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelected(file); onFile(file); }
  }, [onFile]);

  return (
    <label
      htmlFor="file-input"
      className={`dropzone ${dragOver ? "drag-over" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{ display: "block", cursor: "pointer" }}
    >
      <input
        id="file-input"
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
      />

      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
        {selected ? "📎" : "📂"}
      </div>

      {selected ? (
        <>
          <div style={{ fontWeight: 600, color: "var(--accent-cyan)", marginBottom: "0.25rem" }}>
            {selected.name}
          </div>
          <div className="text-muted text-sm">
            {(selected.size / 1024).toFixed(1)} KB · Click to change
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
            Drop your file here
          </div>
          <div className="text-muted text-sm">
            or click to browse · Any file type accepted
          </div>
        </>
      )}
    </label>
  );
}
