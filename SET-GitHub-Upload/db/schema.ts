import { sql } from "drizzle-orm";
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  ownerId: text("owner_id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull().default(""),
  avatar: text("avatar").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const friendships = sqliteTable("friendships", {
  ownerId: text("owner_id").notNull(),
  friendCode: text("friend_code").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [primaryKey({columns:[table.ownerId,table.friendCode]})]);

export const friendRequests = sqliteTable("friend_requests", {
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [primaryKey({columns:[table.senderId,table.recipientId]})]);

export const communityPosts = sqliteTable("community_posts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  date: text("date").notNull(),
  capturedAt: text("captured_at").notNull(),
  image: text("image").notNull(),
  workoutName: text("workout_name").notNull().default("Freies Training"),
  createdAt: text("created_at").notNull(),
});
