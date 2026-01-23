import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("oderId", args.userId))
      .first();
    return settings;
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    aiProvider: v.optional(v.string()),
    editor: v.optional(v.string()),
    theme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("oderId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiProvider: args.aiProvider,
        editor: args.editor,
        theme: args.theme,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userSettings", {
        oderId: args.userId,
        aiProvider: args.aiProvider,
        editor: args.editor,
        theme: args.theme,
      });
    }
  },
});
