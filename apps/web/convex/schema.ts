import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userSettings: defineTable({
    oderId: v.string(),
    aiProvider: v.optional(v.string()),
    editor: v.optional(v.string()),
    theme: v.optional(v.string()),
  }).index("by_user", ["oderId"]),

  recentProjects: defineTable({
    userId: v.string(),
    path: v.string(),
    name: v.string(),
    lastOpenedAt: v.number(),
    remoteUrl: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_path", ["userId", "path"]),
});
