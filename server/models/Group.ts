import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { MatchCategory } from './MatchRequest.ts';

export type GroupStatus = 'open' | 'full' | 'closed';
export type JoinMode = 'approval' | 'instant';
export type JoinRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface IJoinRequestItem {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  message: string;
  status: JoinRequestStatus;
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
}

export interface IGroup extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  category: MatchCategory;
  description: string;
  city: string;
  ownerId: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  joinRequests: IJoinRequestItem[];
  maxCapacity: number;
  joinMode: JoinMode;
  status: GroupStatus;
  linkedRequestIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const JoinRequestItemSchema = new Schema<IJoinRequestItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, trim: true, default: '', maxlength: 400 },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const GroupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    category: { type: String, enum: ['shopping', 'travel', 'hackathon', 'event'], required: true, index: true },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    city: { type: String, required: true, trim: true, maxlength: 80, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [], index: true },
    joinRequests: { type: [JoinRequestItemSchema], default: [] },
    maxCapacity: { type: Number, required: true, min: 2, max: 50, default: 4 },
    joinMode: { type: String, enum: ['approval', 'instant'], default: 'approval' },
    status: { type: String, enum: ['open', 'full', 'closed'], default: 'open', index: true },
    linkedRequestIds: { type: [{ type: Schema.Types.ObjectId, ref: 'MatchRequest' }], default: [] },
  },
  { timestamps: true }
);

GroupSchema.index({ category: 1, status: 1 });

export const Group: Model<IGroup> = mongoose.models.Group || mongoose.model<IGroup>('Group', GroupSchema);
