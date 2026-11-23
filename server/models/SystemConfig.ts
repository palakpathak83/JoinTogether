import mongoose, { Schema, type Document, type Model } from 'mongoose';

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

export const DEFAULT_MATCH_WEIGHTS: CategoryMatchWeights = {
  shopping: {
    storeWeight: 35,
    zoneWeight: 25,
    thresholdWeight: 25,
    discountSplitWeight: 15,
  },
  travel: {
    destinationWeight: 35,
    originWeight: 20,
    dateWeight: 25,
    modePaceWeight: 20,
  },
  hackathon: {
    eventWeight: 30,
    roleFitWeight: 35,
    stackWeight: 20,
    formatLevelWeight: 15,
  },
  event: {
    titleWeight: 40,
    venueDateWeight: 25,
    budgetTierWeight: 20,
    vibeWeight: 15,
  },
};

export interface ISystemConfig extends Document {
  key: string;
  adminClaimed: boolean;
  claimedByUserId?: mongoose.Types.ObjectId;
  matchWeights: CategoryMatchWeights;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    adminClaimed: { type: Boolean, default: false },
    claimedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    matchWeights: { type: Schema.Types.Mixed, default: () => DEFAULT_MATCH_WEIGHTS },
  },
  { timestamps: true }
);

export const SystemConfig: Model<ISystemConfig> =
  mongoose.models.SystemConfig || mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

export async function getSystemConfig(): Promise<ISystemConfig> {
  let doc = await SystemConfig.findOne({ key: 'global' });
  if (!doc) {
    doc = await SystemConfig.create({
      key: 'global',
      adminClaimed: false,
      matchWeights: DEFAULT_MATCH_WEIGHTS,
    });
  }
  return doc;
}
