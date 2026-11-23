import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type NotificationType =
  | 'match_found'
  | 'join_request'
  | 'request_accepted'
  | 'request_rejected'
  | 'group_message'
  | 'member_left'
  | 'group_closed'
  | 'system';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  relatedGroupId?: mongoose.Types.ObjectId | null;
  relatedRequestId?: mongoose.Types.ObjectId | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['match_found', 'join_request', 'request_accepted', 'request_rejected', 'group_message', 'member_left', 'group_closed', 'system'],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 400 },
    relatedGroupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: 'MatchRequest', default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
