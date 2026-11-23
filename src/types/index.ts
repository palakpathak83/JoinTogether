export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type MatchCategory = 'shopping' | 'travel' | 'hackathon' | 'event';
export type RequestStatus = 'active' | 'matched' | 'cancelled' | 'expired';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  city: string;
  bio: string;
  skills: string[];
  interests: string[];
  isActive: boolean;
  createdAt?: string;
}

export interface ShoppingDetails {
  storeName: string;
  productCategory: string;
  targetDiscountPct: number;
  minOrderAmount: number;
  userSpendAmount: number;
  deliveryZone: string;
  splitType: 'equal' | 'proportional';
}

export interface TravelDetails {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  budgetMax: number;
  transportMode: 'carpool' | 'train' | 'flight' | 'van';
  pace: 'relaxed' | 'moderate' | 'packed';
}

export interface HackathonDetails {
  eventName: string;
  hackathonFormat: 'online' | 'in-person' | 'hybrid';
  neededRoles: string[];
  offeredRole: string;
  techStack: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
}

export interface EventDetails {
  eventTitle: string;
  venue: string;
  eventDate: string;
  ticketTier: 'standard' | 'vip' | 'group-pass';
  maxBudget: number;
  vibe: 'networking' | 'casual' | 'focused';
}

export interface MatchRequest {
  _id: string;
  creatorId: string | { _id: string; name: string; city: string };
  category: MatchCategory;
  title: string;
  description: string;
  city: string;
  status: RequestStatus;
  expiresAt: string;
  maxGroupSize: number;
  matchedGroupId?: string | null;
  details: ShoppingDetails | TravelDetails | HackathonDetails | EventDetails;
  createdAt: string;
}

export interface ScoredMatchItem {
  requestId: string;
  category: MatchCategory;
  title: string;
  description: string;
  city: string;
  maxGroupSize: number;
  expiresAt: string;
  matchedGroupId: string | null;
  details: MatchRequest['details'];
  creator: {
    _id: string;
    name: string;
    city: string;
    bio: string;
    skills: string[];
    interests: string[];
  };
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
}

export interface PaginatedMatchResult {
  sourceRequestId: string;
  category: MatchCategory;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  matches: ScoredMatchItem[];
}

export interface GroupMember {
  _id: string;
  name: string;
  city: string;
  skills?: string[];
}

export interface JoinRequestItem {
  _id: string;
  userId: string | { _id: string; name: string; city: string; bio?: string; skills?: string[] };
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedAt: string;
}

export interface Group {
  _id: string;
  name: string;
  category: MatchCategory;
  description: string;
  city: string;
  ownerId: string | { _id: string; name: string; city: string; bio?: string };
  members: Array<string | GroupMember>;
  joinRequests?: JoinRequestItem[];
  maxCapacity: number;
  joinMode: 'approval' | 'instant';
  status: 'open' | 'full' | 'closed';
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  content: string;
  readBy: Array<{ userId: string; readAt: string }>;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedGroupId?: string | null;
  relatedRequestId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface HealthResponse {
  service: string;
  status: 'ok' | 'degraded';
  database: {
    state: 'connected' | 'connecting' | 'disconnected' | 'unconfigured';
    readyState: number;
    error: string | null;
  };
  timestamp: string;
}

export interface CategoryMatchWeights {
  shopping: {
    storeWeight: number;
    zoneWeight: number;
    thresholdWeight: number;
    discountSplitWeight: number;
  };
  travel: {
    destinationWeight: number;
    originWeight: number;
    dateWeight: number;
    modePaceWeight: number;
  };
  hackathon: {
    eventWeight: number;
    roleFitWeight: number;
    stackWeight: number;
    formatLevelWeight: number;
  };
  event: {
    titleWeight: number;
    venueDateWeight: number;
    budgetTierWeight: number;
    vibeWeight: number;
  };
}
