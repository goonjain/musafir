// PlannerWizard.tsx – Four‑step itinerary questionnaire
import React, { useState } from "react";
import { PLACES, INTERESTS } from "@/lib/jaipur-data";
import VibeCard from "./VibeCard";
import { SectionTitle } from "./Sections"; // reuse title component if needed

export type Plan = {
  day: string;
  time: "half" | "full";
  budget: number;
  interests: string[];
  type: string;
  crowd: string;
  must: string;
};

// Simple field helper (duplicate from Sections for independence)
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function PlannerWizard({ plan, setPlan, onGenerate }: {
  plan: Plan;
  setPlan: (p: Plan) => void;
  onGenerate: () => void;
}) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // STEP 1 state
  const [startDateTime, setStartDateTime] = useState<string>("");
  const [endDateTime, setEndDateTime] = useState<string>("");
  const [startLocation, setStartLocation] = useState<string>("");
  const [customLocation, setCustomLocation] = useState<string>("");
  const [notesStep1, setNotesStep1] = useState<string>("");

  // Existing state
  const [date, setDate] = useState<string>("");
  const [startPlace, setStartPlace] = useState<string>(plan.must);
  const [startTime, setStartTime] = useState<string>("");
  const [crowdPref, setCrowdPref] = useState<string>(plan.crowd);
  const [allowGems, setAllowGems] = useState<boolean>(true);

const vibeOptions = [
  { id: "heritage", title: "Royal & Historic", img: "/images/vibes/royal.jpg" },
  { id: "shopping", title: "Markets & Finds", img: "/images/vibes/markets.jpg" },
  { id: "food", title: "Food Trails", img: "/images/vibes/food.jpg" },
  { id: "photography", title: "Picture Perfect", img: "/images/vibes/photography.jpg" },
  { id: "relax", title: "Slow & Scenic", img: "/images/vibes/scenic.jpg" },
  { id: "culture", title: "Local Culture", img: "/images/vibes/culture.jpg" },
];

  const toggleInterest = (tag: string) => {
    const on = plan.interests.includes(tag);
    setPlan({
      ...plan,
      interests: on ? plan.interests.filter((i) => i !== tag) : [...plan.interests, tag],
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return date !== "" && startPlace !== "" && plan.time !== "" && plan.day !== "";
      case 2:
        return plan.interests.length > 0;
      case 3:
        return plan.type !== "" && plan.budget > 0;
      case 4:
        return crowdPref !== "";
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps && canProceed()) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="When are we exploring?">
              <input type="date" className="w-full rounded border p-2" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="How much time have you got?">
              <div className="flex gap-2">
                <button type="button" className={`rounded border px-4 py-1 ${plan.time === "half" ? "border-primary bg-primary text-primary-foreground" : ""}`} onClick={() => setPlan({ ...plan, time: "half" })}>Half‑day</button>
                <button type="button" className={`rounded border px-4 py-1 ${plan.time === "full" ? "border-primary bg-primary text-primary-foreground" : ""}`} onClick={() => setPlan({ ...plan, time: "full" })}>Full day</button>
              </div>
            </Field>
            <Field label="Where should we start?">
              <select className="w-full rounded border p-2" value={startPlace} onChange={(e) => { setStartPlace(e.target.value); setPlan({ ...plan, must: e.target.value }); }}>
                <option value="">Select a place</option>
                {PLACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Optional start time (e.g., 09:00)">
              <input type="time" className="w-full rounded border p-2" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
          </div>
        );
      case 2:
        return (
          <div className="grid gap-4 md:grid-cols-3">
            {vibeOptions.map((v) => (
              <VibeCard key={v.id} id={v.id} title={v.title} img={v.img} selected={plan.interests.includes(v.id)} onToggle={() => toggleInterest(v.id)} />
            ))}
          </div>
        );
      case 3:
        return (
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Who’s coming along?">
              <div className="flex flex-wrap gap-2">
                {["solo", "friends", "couple", "family"].map((t) => (
                  <button key={t} type="button" className={`rounded border px-4 py-1 ${plan.type === t ? "border-primary bg-primary text-primary-foreground" : ""}`} onClick={() => setPlan({ ...plan, type: t })}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Budget: ₹${plan.budget.toLocaleString("en-IN")}`}>
              <input type="range" min={500} max={6000} step={250} value={plan.budget} onChange={(e) => setPlan({ ...plan, budget: +e.target.value })} className="w-full accent-[var(--primary)]" />
            </Field>
          </div>
        );
      case 4:
        return (
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Crowds or calm?">
              <select className="w-full rounded border p-2" value={crowdPref} onChange={(e) => setCrowdPref(e.target.value)}>
                <option value="avoid">Avoid crowds</option>
                <option value="neutral">Neutral</option>
                <option value="seek">Seek lively spots</option>
              </select>
            </Field>
            <Field label="Open to hidden gems?">
              <label className="inline-flex items-center">
                <input type="checkbox" className="h-4 w-4 rounded border-primary" checked={allowGems} onChange={() => setAllowGems(!allowGems)} />
                <span className="ml-2">Yes, surprise me!</span>
              </label>
            </Field>
            <div className="col-span-2 rounded border p-4 bg-muted/30">
              <h3 className="font-medium mb-2">Your plan preview</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Date: {date || "(not set)"}</li>
                <li>Duration: {plan.time === "half" ? "Half‑day" : "Full day"}</li>
                <li>Start: {startPlace || "(not set)"} {startTime && `@ ${startTime}`}</li>
                <li>Vibes: {plan.interests.join(", ")}</li>
                <li>Group: {plan.type}</li>
                <li>Budget: ₹{plan.budget}</li>
                <li>Crowd: {crowdPref}</li>
                <li>Hidden gems: {allowGems ? "Yes" : "No"}</li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const finalize = () => {
    setPlan({ ...plan, crowd: crowdPref, must: plan.must });
    onGenerate();
  };

  return (
    <div className="mx-auto max-w-4xl bg-card p-6 pt-14 md:p-10 md:pt-16">
      <div className="flex justify-center gap-2 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span key={i} className={`w-3 h-3 rounded-full ${i + 1 === step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
      {renderStep()}
      <div className="mt-8 flex justify-between">
        <button type="button" onClick={handleBack} disabled={step === 1} className="rounded bg-muted px-4 py-2 disabled:opacity-50">Back</button>
        {step < totalSteps && (
          <button type="button" onClick={handleNext} disabled={!canProceed()} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Next</button>
        )}
        {step === totalSteps && (
          <button type="button" onClick={finalize} className="rounded bg-primary px-4 py-2 text-primary-foreground">Build My Jaipur Day</button>
        )}
      </div>
    </div>
  );
}

