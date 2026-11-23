import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IReadReceipt {
  userId: mongoose.Types.ObjectId;
  readAt: Date;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  content: string;
  readBy: IReadReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

const ReadReceiptSchema = new Schema<IReadReceipt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true, trim: true, maxlength: 80 },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    readBy: { type: [ReadReceiptSchema], default: [] },
  },
  { timestamps: true }
);

MessageSchema.index({ groupId: 1, createdAt: 1 });

export const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
