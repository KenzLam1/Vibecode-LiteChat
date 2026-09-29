CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`title_source` text DEFAULT 'default' NOT NULL,
	`model_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "title_source_valid" CHECK("conversations"."title_source" in ('default', 'fallback', 'auto', 'user'))
);
--> statement-breakpoint
CREATE INDEX `conversations_user_updated_idx` ON `conversations` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `login_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "role_valid" CHECK("messages"."role" in ('user', 'assistant'))
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`system_prompt` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "username_lowercase" CHECK("users"."username" = lower("users"."username")),
	CONSTRAINT "system_prompt_length" CHECK(length("users"."system_prompt") <= 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);