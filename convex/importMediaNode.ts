"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const storeImportedAudio = action({
  args: {
    filename: v.string(),
    contentType: v.string(),
    base64Data: v.string(),
  },
  handler: async (ctx, args): Promise<{ audioUrl: string }> => {
    const bytes = Buffer.from(args.base64Data, "base64");
    const blob = new Blob([bytes], { type: args.contentType || "application/octet-stream" });
    const storageId = await ctx.storage.store(blob);
    const audioUrl = await ctx.storage.getUrl(storageId);

    if (!audioUrl) {
      throw new Error(`Failed to resolve stored media URL for ${args.filename}`);
    }

    new URL(audioUrl);
    return { audioUrl };
  },
});
