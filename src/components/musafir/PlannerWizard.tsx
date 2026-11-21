// PlannerWizard.tsx – Premium four‑step itinerary questionnaire
import React, { useState } from "react";
import VibeCard from "./VibeCard";
import { TripPreferences } from "./TripPreferences";
import { PLACES } from "@/lib/jaipur-data"; // for must‑visit options
import { Calendar, Heart, Users, Compass, ArrowRight, CheckCircle, Circle } from "lucide-react"; // icons
import JaipurPhotoSlideshow from "./JaipurPhotoSlideshow";
export type Plan = {
  day: string;
  time: "half" | "full";
  budget: number;
  interests: string[];
  type: string;
  crowd: string;
  must: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ---- Options ---------------------------------------------------
const vibeOptions = [
  { id: "heritage", title: "Royal & Historic", img: "/images/vibes/royal.jpg" },
  { id: "shopping", title: "Markets & Finds", img: "/images/vibes/markets.jpg" },
  { id: "food", title: "Food Trails", img: "/images/vibes/food.jpg" },
  { id: "photography", title: "Picture Perfect", img: "/images/vibes/photography.jpg" },
  { id: "relax", title: "Slow & Scenic", img: "/images/vibes/scenic.jpg" },
  { id: "culture", title: "Local Culture", img: "/images/vibes/culture.jpg" },
];

const groupOptions = ["solo", "partner", "friends", "family", "other"] as const;
const crowdOptions = [
  { value: "avoid", label: "I'd rather avoid them" },
  { value: "neutral", label: "A little crowd is fine" },
  { value: "any", label: "I don't mind the buzz" },
];
const hiddenGemsOptions = [
  { value: "yes", label: "Yes, surprise me" },
  { value: "maybe", label: "Sure, if they're along the way" },
  { value: "no", label: "I'd rather stick to my picks" },
];
const travelPaceOptions = [
  { value: "relaxed", label: "Relaxed — fewer stops" },
  { value: "balanced", label: "Balanced — a little of everything" },
  { value: "packed", label: "Packed — more places" },
];
const foodPrefs = [
  { value: "none", label: "No preference" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "nonVegetarian", label: "Non‑vegetarian" },
  { value: "jain", label: "Jain" },
];

// ---- Main component ------------------------------------------------
export default function PlannerWizard({ plan, setPlan, onGenerate }: { plan: Plan; setPlan: (p: Plan) => void; onGenerate: () => void }) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [submitting, setSubmitting] = useState(false);

  const [preferences, setPreferences] = useState<TripPreferences>({
    startDateTime: "",
    endDateTime: "",
    locationType: "",
    customLocation: "",
    notesStep1: "",
    mustVisit: [],
    foodPreference: "none",
    dietaryRestrictions: "",
    notesStep2: "",
    groupType: "",
    groupSize: 1,
    budget: 0,
    travelPace: "",
    notesStep3: "",
    crowdTolerance: "",
    hiddenGemsPreference: "",
    notesStep4: "",
  });

  const [crowdPref, setCrowdPref] = useState<string>(plan.crowd);

  const toggleInterest = (tag: string) => {
    const already = plan.interests.includes(tag);
    setPlan({
      ...plan,
      interests: already ? plan.interests.filter((i) => i !== tag) : [...plan.interests, tag],
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        const { startDateTime, endDateTime, locationType, customLocation } = preferences;
        if (!startDateTime || !endDateTime) return false;
        if (new Date(endDateTime) < new Date(startDateTime)) return false;
        if (!locationType) return false;
        if (locationType === "other" && !customLocation) return false;
        return true;
      case 2:
        return plan.interests.length > 0;
      case 3:
        return (
          preferences.groupType !== "" &&
          preferences.groupSize > 0 &&
          preferences.budget > 0 &&
          preferences.travelPace !== ""
        );
      case 4:
        return crowdPref !== "" && preferences.hiddenGemsPreference !== "";
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

  const finalize = () => {
    setSubmitting(true);
    setPlan({ ...plan, crowd: crowdPref, must: plan.must });
    onGenerate();
    setTimeout(() => setSubmitting(false), 500);
  };

  // ---- Progress bar -------------------------------------------------
  const renderProgress = () => {
    const icons = [Calendar, Heart, Users, Compass];
    const labels = ["Your Trip", "Your Vibe", "Your Style", "Your Flow"];
    return (
      <div className="flex items-center mb-8">
        {icons.map((Icon, idx) => {
          const stepNum = idx + 1;
          const active = step >= stepNum;
          const completed = step > stepNum;
          return (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center">
                {completed ? (
                  <CheckCircle className="text-pink-500" size={24} />
                ) : (
                  <Icon className={active ? "text-pink-500" : "text-muted-foreground"} size={24} />
                )}
                <span className={active ? "text-pink-600 font-semibold" : "text-muted-foreground text-sm"}>{labels[idx]}</span>
              </div>
              {idx < icons.length - 1 && (
                <div className="flex-1 h-px bg-muted mx-2" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ---- Step render --------------------------------------------------
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left image — automatic Jaipur slideshow */}
            <div className="relative overflow-hidden rounded-xl">
              <JaipurPhotoSlideshow />
            </div>
            {/* Right questionnaire */}
            <div className="space-y-6">
              <h2 className="text-2xl font-display text-primary flex items-center gap-2">
                <Calendar size={20} /> When's your Jaipur story happening?
              </h2>
              <Field label="When do we have you in Jaipur?">
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="date"
                    className="w-full rounded border p-2"
                    value={preferences.startDateTime.split("T")[0]}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        startDateTime: e.target.value + (preferences.startDateTime.includes("T") ? "T" + preferences.startDateTime.split("T")[1] : ""),
                      })
                    }
                  />
                  <input
                    type="date"
                    className="w-full rounded border p-2"
                    value={preferences.endDateTime.split("T")[0]}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        endDateTime: e.target.value + (preferences.endDateTime.includes("T") ? "T" + preferences.endDateTime.split("T")[1] : ""),
                      })
                    }
                  />
                </div>
                {/* Optional times */}
                <div className="mt-2 grid gap-4 md:grid-cols-2">
                  <input
                    type="time"
                    className="w-full rounded border p-2"
                    placeholder="Start time (optional)"
                    value={preferences.startDateTime.includes("T") ? preferences.startDateTime.split("T")[1] : ""}
                    onChange={(e) => {
                      const datePart = preferences.startDateTime.split("T")[0] || "";
                      setPreferences({
                        ...preferences,
                        startDateTime: datePart + (e.target.value ? "T" + e.target.value : ""),
                      });
                    }}
                  />
                  <input
                    type="time"
                    className="w-full rounded border p-2"
                    placeholder="End time (optional)"
                    value={preferences.endDateTime.includes("T") ? preferences.endDateTime.split("T")[1] : ""}
                    onChange={(e) => {
                      const datePart = preferences.endDateTime.split("T")[0] || "";
                      setPreferences({
                        ...preferences,
                        endDateTime: datePart + (e.target.value ? "T" + e.target.value : ""),
                      });
                    }}
                  />
                </div>
                {preferences.startDateTime && preferences.endDateTime && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Duration: {Math.round((new Date(preferences.endDateTime).getTime() - new Date(preferences.startDateTime).getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s)
                  </p>
                )}
              </Field>
              <Field label="Where will your day begin?">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[{ id: "hotel", label: "Hotel / Stay", icon: "🏨" }, { id: "station", label: "Station / Airport", icon: "🚉" }, { id: "other", label: "Somewhere Else", icon: "📍" }].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`flex flex-col items-center p-4 rounded border ${preferences.locationType === opt.id ? "border-pink-500 bg-pink-50" : "border-muted"}`}
                      onClick={() => setPreferences({ ...preferences, locationType: opt.id as any })}
                    >
                      <span className="text-2xl mb-2">{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                  {preferences.locationType === "other" && (
                    <input
                      type="text"
                      placeholder="Enter location"
                      className="col-span-3 w-full rounded border p-2 mt-2"
                      value={preferences.customLocation}
                      onChange={(e) => setPreferences({ ...preferences, customLocation: e.target.value })}
                    />
                  )}
                </div>
              </Field>
              <Field label="Anything else we should know?">
                <textarea
                  placeholder="I'm reaching after an overnight train, so I'd prefer an easy first morning."
                  rows={3}
                  className="w-full rounded border p-2"
                  value={preferences.notesStep1}
                  onChange={(e) => setPreferences({ ...preferences, notesStep1: e.target.value })}
                />
              </Field>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display text-primary flex items-center gap-2">
              <Heart size={20} /> What's your Jaipur vibe?
            </h2>
            <Field label="Select your vibes (multiple)">
              <div className="grid gap-4 md:grid-cols-3">
                {vibeOptions.map((v) => (
                  <VibeCard
                    key={v.id}
                    id={v.id}
                    title={v.title}
                    img={v.img}
                    selected={plan.interests.includes(v.id)}
                    onToggle={() => toggleInterest(v.id)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Must‑visit attractions">
              <select
                multiple
                className="w-full rounded border p-2"
                value={preferences.mustVisit}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                  setPreferences({ ...preferences, mustVisit: selected });
                }}
              >
                {PLACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex space-x-2">
                <input
                  type="text"
                  placeholder="Add custom place"
                  className="flex-1 rounded border p-2"
                  value={preferences.notesStep2}
                  onChange={(e) => setPreferences({ ...preferences, notesStep2: e.target.value })}
                />
                <button
                  type="button"
                  className="rounded bg-primary px-3 py-1 text-primary-foreground"
                  onClick={() => {
                    if (preferences.notesStep2.trim()) {
                      setPreferences({
                        ...preferences,
                        mustVisit: [...preferences.mustVisit, preferences.notesStep2.trim()],
                        notesStep2: "",
                      });
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </Field>
            <Field label="Food preferences">
              <div className="flex flex-wrap gap-2">
                {foodPrefs.map((fp) => (
                  <button
                    key={fp.value}
                    type="button"
                    className={`px-3 py-1 rounded border ${preferences.foodPreference === fp.value ? "bg-pink-100 border-pink-500" : "bg-muted"}`}
                    onClick={() => setPreferences({ ...preferences, foodPreference: fp.value as any })}
                  >
                    {fp.label}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Allergies, dietary restrictions, special requests..."
                rows={2}
                className="w-full rounded border p-2 mt-2"
                value={preferences.dietaryRestrictions}
                onChange={(e) => setPreferences({ ...preferences, dietaryRestrictions: e.target.value })}
              />
            </Field>
            <Field label="Additional notes">
              <textarea
                rows={3}
                className="w-full rounded border p-2"
                value={preferences.notesStep2}
                onChange={(e) => setPreferences({ ...preferences, notesStep2: e.target.value })}
              />
            </Field>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display text-primary flex items-center gap-2">
              <Users size={20} /> Let's make this work for you.
            </h2>
            <Field label="Who's coming along?">
              <div className="flex flex-wrap gap-2 mb-2">
                {groupOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`px-3 py-1 rounded border ${preferences.groupType === t ? "bg-pink-100 border-pink-500" : "bg-muted"}`}
                    onClick={() => setPreferences({ ...preferences, groupType: t })}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPreferences({ ...preferences, groupSize: Math.max(1, preferences.groupSize - 1) })}
                  className="rounded border px-2 py-1"
                >
                  –
                </button>
                <span>{preferences.groupSize}</span>
                <button
                  type="button"
                  onClick={() => setPreferences({ ...preferences, groupSize: preferences.groupSize + 1 })}
                  className="rounded border px-2 py-1"
                >
                  +
                </button>
              </div>
            </Field>
            <Field label="Budget (₹)">
              <div className="flex flex-wrap gap-2">
                {[1000, 2000, 3000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`px-3 py-1 rounded border ${preferences.budget === amt ? "bg-pink-100 border-pink-500" : "bg-muted"}`}
                    onClick={() => setPreferences({ ...preferences, budget: amt })}
                  >
                    ₹{amt}
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Custom"
                  className="w-24 rounded border p-2"
                  value={preferences.budget !== 0 && ![1000, 2000, 3000, 5000].includes(preferences.budget) ? preferences.budget : ""}
                  onChange={(e) => setPreferences({ ...preferences, budget: Number(e.target.value) })}
                />
              </div>
            </Field>
            <Field label="Travel pace">
              <div className="flex flex-wrap gap-2">
                {travelPaceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`px-3 py-1 rounded border ${preferences.travelPace === opt.value ? "bg-pink-100 border-pink-500" : "bg-muted"}`}
                    onClick={() => setPreferences({ ...preferences, travelPace: opt.value as any })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Additional notes">
              <textarea
                rows={3}
                className="w-full rounded border p-2"
                value={preferences.notesStep3}
                onChange={(e) => setPreferences({ ...preferences, notesStep3: e.target.value })}
              />
            </Field>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display text-primary flex items-center gap-2">
              <Compass size={20} /> One last thing before we plan.
            </h2>
            <Field label="Crowd tolerance">
              <div className="flex flex-wrap gap-2">
                {crowdOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`px-3 py-1 rounded border ${crowdPref === opt.value ? "bg-pink-100 border-pink-500" : "bg-muted"}`}
                    onClick={() => setCrowdPref(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Hidden gems">
              <div className="flex flex-wrap gap-2">
                {hiddenGemsOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`px-3 py-1 rounded border ${preferences.hiddenGemsPreference === opt.value ? "bg-pink-100 border-pink-500" : "bg-muted"}`}
                    onClick={() => setPreferences({ ...preferences, hiddenGemsPreference: opt.value as any })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            {/* Travel‑journal style summary */}
            <div className="rounded border p-4 bg-muted/30">
              <h3 className="font-medium mb-2">Your trip summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>Dates: {preferences.startDateTime.split("T")[0]} – {preferences.endDateTime.split("T")[0]}</div>
                <div>Trip length: {Math.round((new Date(preferences.endDateTime).getTime() - new Date(preferences.startDateTime).getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s)</div>
                <div>Start location: {preferences.locationType === "other" ? preferences.customLocation : preferences.locationType}</div>
                <div>Vibes: {plan.interests.map((id) => vibeOptions.find((v) => v.id === id)?.title).filter(Boolean).join(", ")}</div>
                <div>Must‑visit: {preferences.mustVisit.join(", ")}</div>
                <div>Food: {preferences.foodPreference}{preferences.dietaryRestrictions ? ` – ${preferences.dietaryRestrictions}` : ""}</div>
                <div>Group: {preferences.groupType} ({preferences.groupSize} people)</div>
                <div>Budget: ₹{preferences.budget}</div>
                <div>Travel pace: {travelPaceOptions.find((o) => o.value === preferences.travelPace)?.label}</div>
                <div>Crowd tolerance: {crowdOptions.find((o) => o.value === crowdPref)?.label}</div>
                <div>Hidden gems: {hiddenGemsOptions.find((o) => o.value === preferences.hiddenGemsPreference)?.label}</div>
                {preferences.notesStep1 && <div>Notes (step 1): {preferences.notesStep1}</div>}
                {preferences.notesStep2 && <div>Notes (step 2): {preferences.notesStep2}</div>}
                {preferences.notesStep3 && <div>Notes (step 3): {preferences.notesStep3}</div>}
              </div>
              <div className="mt-4 flex space-x-2">
                <button type="button" className="text-sm text-primary underline" onClick={() => setStep(1)}>
                  Edit Step 1
                </button>
                <button type="button" className="text-sm text-primary underline" onClick={() => setStep(2)}>
                  Edit Step 2
                </button>
                <button type="button" className="text-sm text-primary underline" onClick={() => setStep(3)}>
                  Edit Step 3
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-5xl bg-[#fdf8f0] border border-pink-200 rounded-xl shadow-lg p-8 md:p-12">
      {renderProgress()}
      <div className="flex justify-center mb-4">
        <p className="text-sm text-muted-foreground">
          Step {step} of {totalSteps} — {['Set the Scene', 'Pick Your Vibe', 'Make It Yours', 'Finalize'][step - 1]}
        </p>
      </div>
      {renderStep()}
      <div className="mt-8 flex justify-between">
        <button type="button" onClick={handleBack} disabled={step === 1} className="rounded bg-muted px-4 py-2 disabled:opacity-50">
          Back
        </button>
        {step < totalSteps && (
          <button type="button" onClick={handleNext} disabled={!canProceed()} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
            Continue
          </button>
        )}
        {step === totalSteps && (
          <button type="button" onClick={finalize} disabled={submitting} className="rounded bg-primary px-4 py-2 text-primary-foreground flex items-center">
            {submitting ? (
              <>
                <ArrowRight className="animate-spin mr-2" size={16} />Generating…
              </>
            ) : (
              "Plan My Jaipur Trip"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
