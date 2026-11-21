// TripPreferences.ts – data model for additional questionnaire inputs

export interface TripPreferences {
  // Step 1 – dates & start location
  startDateTime: string; // ISO string from <input type="datetime-local">
  endDateTime: string; // ISO string from <input type="datetime-local">
  locationType: "hotel" | "station" | "other" | ""; // selected option
  customLocation: string; // free‑form text when locationType === "other"
  notesStep1: string; // optional free‑form note for step 1

  // Step 2 – vibe & must‑visit (placeholder, will be filled later)
  mustVisit: string[]; // IDs of attractions the user must see
  foodPreference: "none" | "vegetarian" | "vegan" | "nonVegetarian" | "jain"; // simplified enum
  dietaryRestrictions: string; // free‑form extra info
  notesStep2: string;

  // Step 3 – group & budget
  groupType: "solo" | "partner" | "friends" | "family" | "other" | "";
  groupSize: number; // at least 1
  budget: number; // total INR budget
  travelPace: "relaxed" | "balanced" | "intense" | ""; // travel‑pace preference
  notesStep3: string;

  // Step 4 – crowd & hidden gems
  crowdTolerance: "avoid" | "balanced" | "any" | ""; // how user feels about crowds
  hiddenGemsPreference: "yes" | "maybe" | "no" | ""; // hidden gems flag
  notesStep4: string;
}

