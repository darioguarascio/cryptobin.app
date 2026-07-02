CREATE TABLE "shared_inboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"owner_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_inboxes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shared_inbox_members" (
	"inbox_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(16) DEFAULT 'member' NOT NULL,
	"wrapped_private_key" jsonb NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_inbox_members_inbox_id_user_id_pk" PRIMARY KEY("inbox_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shared_inbox_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_id" uuid NOT NULL,
	"invitee_handle" varchar(64) NOT NULL,
	"invitee_id" uuid,
	"invited_by" uuid NOT NULL,
	"wrapped_private_key" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_inbox_drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_id" uuid NOT NULL,
	"algorithm" varchar(32) NOT NULL,
	"iv" text NOT NULL,
	"ciphertext" text NOT NULL,
	"wrapped_key" text NOT NULL,
	"metadata_preview" jsonb,
	"read_by" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shared_inboxes" ADD CONSTRAINT "shared_inboxes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_inbox_members" ADD CONSTRAINT "shared_inbox_members_inbox_id_shared_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."shared_inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_inbox_members" ADD CONSTRAINT "shared_inbox_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_inbox_invites" ADD CONSTRAINT "shared_inbox_invites_inbox_id_shared_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."shared_inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_inbox_invites" ADD CONSTRAINT "shared_inbox_invites_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_inbox_invites" ADD CONSTRAINT "shared_inbox_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_inbox_drops" ADD CONSTRAINT "shared_inbox_drops_inbox_id_shared_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."shared_inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_inboxes_slug_idx" ON "shared_inboxes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shared_inbox_members_user_id_idx" ON "shared_inbox_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shared_inbox_members_inbox_id_idx" ON "shared_inbox_members" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "shared_inbox_invites_invitee_id_idx" ON "shared_inbox_invites" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE INDEX "shared_inbox_invites_inbox_id_idx" ON "shared_inbox_invites" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "shared_inbox_drops_inbox_id_idx" ON "shared_inbox_drops" USING btree ("inbox_id");
