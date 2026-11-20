import React from "react";

interface VibeCardProps {
  id: string;
  title: string;
  img: string;
  selected: boolean;
  onToggle: () => void;
}

export default function VibeCard({ id, title, img, selected, onToggle }: VibeCardProps) {
  return (
    <button
      type="button"
      className={`relative flex flex-col items-center gap-2 rounded-xl border p-2 transition-shadow ${selected ? "border-primary bg-primary/10" : "border-border"} max-w-xs`}
      onClick={onToggle}
    >
      <img src={img} alt={title} className="w-full h-48 object-cover rounded-lg" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/vibes/placeholder.jpg'; }} />
      <span className="font-medium capitalize text-center" style={{fontSize: '0.9rem'}}>{title}</span>
      {selected && (
        <span className="absolute top-2 right-2 text-primary">✔</span>
      )}
    </button>
  );
}

