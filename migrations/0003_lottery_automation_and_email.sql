ALTER TABLE lottery_settings ADD COLUMN max_participants INTEGER;
ALTER TABLE lottery_settings ADD COLUMN scheduled_open_at TEXT;

ALTER TABLE draw_records ADD COLUMN contact_email TEXT;
ALTER TABLE draw_records ADD COLUMN email_status TEXT NOT NULL DEFAULT 'not_applicable';
ALTER TABLE draw_records ADD COLUMN email_sent_at TEXT;
ALTER TABLE draw_records ADD COLUMN email_error TEXT;
