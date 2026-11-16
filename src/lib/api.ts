import { PLACES, byId, crowdScore, level, type ForecastInput, type Place } from "./jaipur-data";

export const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000/api";

export function getUserId(): string {
  if (typeof window === "undefined") return "guest";
  let uid = localStorage.getItem("musafir_user_id");
  if (!uid) {
    uid = `traveller_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem("musafir_user_id", uid);
  }
  return uid;
}

export function getUserName(): string {
  if (typeof window === "undefined") return "Traveller";
  return localStorage.getItem("musafir_user_name") || "Traveller";
}

export function setUserName(name: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("musafir_user_name", name);
  }
}

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const userId = getUserId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-User-Id": userId,
    ...(options?.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // Non-json response
    }

    if (!res.ok) {
      const errorMsg = json?.detail || json?.message || `HTTP error ${res.status}`;
      return { data: null, error: errorMsg, status: res.status };
    }

    return { data: json as T, error: null, status: res.status };
  } catch (err: any) {
    return {
      data: null,
      error: "Unable to connect to Musafir backend server. Please check your connection or start the backend service.",
      status: 0,
    };
  }
}

/* ---------------- Real Community API ---------------- */

export type RealCrowdReport = {
  id: number;
  destination_id: string;
  destination_name: string;
  user_id: string;
  user_name: string;
  crowd_level: "Quiet" | "Moderate" | "Busy" | "Packed";
  vs_forecast?: string;
  wait_minutes: number;
  tip?: string;
  image?: string | null;
  observed_at: string;
  submitted_at: string;
  forecast_score_at_report?: number;
  moderation_status: "approved" | "pending" | "flagged" | "rejected";
  trust_weight: number;
  accuracy_votes_count: number;
  ago: string;
};

export type LiveCrowdData = {
  destination_id: string;
  destination_name: string;
  forecast_score: number;
  live_score: number;
  adjustment: number;
  report_count: number;
  last_update: string | null;
  status_label: string;
  level: "Low" | "Moderate" | "High" | "Critical";
};

export type DestinationItem = {
  id: string;
  name: string;
  hindi?: string | null;
  category?: string;
  cost?: number;
  hours?: string | null;
  tags?: string[];
  capacity?: number;
  sensitivity?: string;
  base_crowd?: number;
  is_gem?: boolean;
  alternatives?: string[];
};

export type PostComment = {
  id: number;
  post_id: number;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  ago: string;
  moderation_status: string;
};

export type TravelPost = {
  id: number;
  user_id: string;
  user_name: string;
  destination_id?: string | null;
  destination_name?: string | null;
  title?: string | null;
  content: string;
  image_url?: string | null;
  created_at: string;
  ago: string;
  moderation_status: string;
  likes_count: number;
  has_liked: boolean;
  comments_count: number;
  comments: PostComment[];
};

export type RewardBalanceData = {
  user_id: string;
  total_points: number;
  daily_points_today: number;
  daily_cap: number;
  badges: Array<{
    name: string;
    need: number;
    icon: string;
    description: string;
    unlocked: boolean;
  }>;
  recent_transactions: Array<{
    id: number;
    points: number;
    reason: string;
    reference_id: string;
    created_at: string;
  }>;
};

export const api = {
  // 1. Crowd Reports & Place Feed
  async getReports(destinationId?: string): Promise<ApiResponse<{ reports: RealCrowdReport[]; count: number }>> {
    const query = destinationId ? `?destination_id=${encodeURIComponent(destinationId)}` : "";
    return apiRequest<{ reports: RealCrowdReport[]; count: number }>(`/crowd-reports${query}`);
  },

  async submitReport(payload: {
    destination_id: string;
    crowd_level: "Quiet" | "Moderate" | "Busy" | "Packed";
    vs_forecast?: "Quieter" | "About right" | "Busier";
    wait_minutes?: number;
    tip?: string;
    image?: string;
    user_name?: string;
  }): Promise<ApiResponse<{
    success: boolean;
    report: RealCrowdReport;
    points_awarded: number;
    total_points: number;
    message: string;
  }>> {
    return apiRequest("/crowd-reports", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // 2. Live crowd score & honest label
  async getLiveCrowd(placeId: string, hour?: number, day = "Sun"): Promise<ApiResponse<LiveCrowdData>> {
    const params = new URLSearchParams();
    if (hour !== undefined) params.append("hour", hour.toString());
    params.append("day", day);
    return apiRequest<LiveCrowdData>(`/places/${encodeURIComponent(placeId)}/live-crowd?${params.toString()}`);
  },

  // 3. Accuracy voting ("Still accurate?")
  async voteAccuracy(reportId: number, vote: 1 | -1 = 1): Promise<ApiResponse<{
    success: boolean;
    report_id: number;
    trust_weight: number;
    accuracy_votes_count: number;
    message: string;
  }>> {
    return apiRequest("/accuracy-votes", {
      method: "POST",
      body: JSON.stringify({ report_id: reportId, vote }),
    });
  },

  // 4. Flag inappropriate report
  async flagReport(reportId: number, reason = "inappropriate"): Promise<ApiResponse<{
    success: boolean;
    report_id: number;
    moderation_status: string;
    message: string;
  }>> {
    return apiRequest(`/reports/${reportId}/flag`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  // 5. Rewards & Badges
  async getRewardBalance(): Promise<ApiResponse<RewardBalanceData>> {
    return apiRequest<RewardBalanceData>("/rewards/balance");
  },

  // 6. Hidden Gem Suggestions & Confirmations
  async submitGemSuggestion(data: {
    place_name: string;
    description: string;
    similar_to_destination_id?: string;
    vibe_tags?: string[];
    fragile_flag?: boolean;
    photo_url?: string;
  }) {
    return apiRequest("/gem-suggestions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getPlaceAlternatives(placeId: string) {
    return apiRequest(`/places/${encodeURIComponent(placeId)}/alternatives`);
  },

  async confirmGemVisit(gemId: string, worthIt: boolean, crowdLevel?: string) {
    return apiRequest(`/gems/${encodeURIComponent(gemId)}/confirmations`, {
      method: "POST",
      body: JSON.stringify({ worth_it: worthIt, crowd_level: crowdLevel }),
    });
  },

  /* ---------------- Destinations & Dynamic Places ---------------- */
  async getDestinations(search?: string): Promise<DestinationItem[]> {
    const qParam = search && search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    const res = await apiRequest<DestinationItem[]>(`/destinations${qParam}`);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    // Fallback to canonical PLACES if backend offline
    return PLACES.map((p) => ({
      id: p.id,
      name: p.name,
      hindi: p.hindi,
      tags: p.tags,
      base_crowd: p.base,
      is_gem: p.gem,
      alternatives: p.alternatives,
    }));
  },

  async createDestination(payload: {
    name: string;
    hindi?: string;
    category?: string;
    tags?: string[];
    sensitivity?: "normal" | "fragile";
  }) {
    return apiRequest<DestinationItem>("/destinations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /* ---------------- Travel Social Community Feed ---------------- */
  async getTravelPosts(destinationId?: string, limit = 25, offset = 0) {
    const params = new URLSearchParams();
    if (destinationId && destinationId !== "all") params.set("destination_id", destinationId);
    params.set("limit", limit.toString());
    params.set("offset", offset.toString());
    return apiRequest<TravelPost[]>(`/posts?${params.toString()}`);
  },

  async createTravelPost(payload: {
    destination_id?: string;
    title?: string;
    content: string;
    image_url?: string;
    user_name?: string;
  }) {
    return apiRequest<TravelPost>("/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async togglePostLike(postId: number) {
    return apiRequest<{ success: boolean; post_id: number; liked: boolean; likes_count: number }>(
      `/posts/${postId}/like`,
      { method: "POST" }
    );
  },

  async getPostComments(postId: number) {
    return apiRequest<PostComment[]>(`/posts/${postId}/comments`);
  },

  async createPostComment(postId: number, payload: { content: string; user_name?: string }) {
    return apiRequest<PostComment>(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /* ---------------- Legacy Compatibility Subsystems ---------------- */
  async getPlaces(): Promise<Place[]> {
    const res = await apiRequest<{ places: Place[] }>("/places");
    return res.data?.places || PLACES;
  },

  async getCircle() {
    const res = await apiRequest<any>("/circle");
    return res.data;
  },

  async voteCircleStop(placeId: string) {
    const res = await apiRequest<any>("/circle/vote", {
      method: "POST",
      body: JSON.stringify({ placeId }),
    });
    return res.data;
  },

  async runSimulator(shift: number) {
    const res = await apiRequest<any>("/simulator", {
      method: "POST",
      body: JSON.stringify({ shift }),
    });
    return res.data;
  },
};
