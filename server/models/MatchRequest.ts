import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type MatchCategory = 'shopping' | 'travel' | 'hackathon' | 'event';
export type RequestStatus = 'active' | 'matched' | 'cancelled' | 'expired';

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

export interface IMatchRequest extends Document {
  _id: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  category: MatchCategory;
  title: string;
  description: string;
  city: string;
  status: RequestStatus;
  expiresAt: Date;
  maxGroupSize: number;
  matchedGroupId?: mongoose.Types.ObjectId | null;
  details: ShoppingDetails | TravelDetails | HackathonDetails | EventDetails;
  createdAt: Date;
  updatedAt: Date;
}

const MatchRequestSchema = new Schema<IMatchRequest>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: ['shopping', 'travel', 'hackathon', 'event'], required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    city: { type: String, required: true, trim: true, maxlength: 80, index: true },
    status: { type: String, enum: ['active', 'matched', 'cancelled', 'expired'], default: 'active', index: true },
    expiresAt: { type: Date, required: true, index: true },
    maxGroupSize: { type: Number, required: true, min: 2, max: 20, default: 4 },
    matchedGroupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    details: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

MatchRequestSchema.index({ category: 1, status: 1, expiresAt: 1 });
MatchRequestSchema.index({ creatorId: 1, status: 1 });

export const MatchRequest: Model<IMatchRequest> =
  mongoose.models.MatchRequest || mongoose.model<IMatchRequest>('MatchRequest', MatchRequestSchema);
