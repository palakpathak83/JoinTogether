import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface RefreshTokenRecord {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  city: string;
  bio: string;
  skills: string[];
  interests: string[];
  isActive: boolean;
  refreshTokens: RefreshTokenRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<RefreshTokenRecord>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['USER', 'ADMIN', 'SUPER_ADMIN'], default: 'USER', index: true },
    city: { type: String, trim: true, default: '', maxlength: 80 },
    bio: { type: String, trim: true, default: '', maxlength: 400 },
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    refreshTokens: { type: [RefreshTokenSchema], default: [], select: false },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
