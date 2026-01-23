import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("recentProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 10);

    return projects.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    path: v.string(),
    name: v.string(),
    remoteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("recentProjects")
      .withIndex("by_user_path", (q) =>
        q.eq("userId", args.userId).eq("path", args.path)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        lastOpenedAt: Date.now(),
        remoteUrl: args.remoteUrl,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("recentProjects", {
        userId: args.userId,
        path: args.path,
        name: args.name,
        lastOpenedAt: Date.now(),
        remoteUrl: args.remoteUrl,
      });
    }
  },
});

export const remove = mutation({
  args: { userId: v.string(), path: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("recentProjects")
      .withIndex("by_user_path", (q) =>
        q.eq("userId", args.userId).eq("path", args.path)
      )
      .first();

    if (project) {
      await ctx.db.delete(project._id);
    }
  },
});
