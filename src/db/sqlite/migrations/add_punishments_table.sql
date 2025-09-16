-- Migration: Add punishments table for punishment history tracking
-- Created: 2025-01-16

CREATE TABLE IF NOT EXISTS punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    executorId TEXT NOT NULL,
    punishmentType TEXT NOT NULL,
    punishmentName TEXT NOT NULL,
    reason TEXT NOT NULL,
    duration INTEGER,
    durationType TEXT,
    appliedAt TEXT NOT NULL,
    expiresAt TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    guildId TEXT NOT NULL,
    proofUrl TEXT,
    removedAt TEXT,
    removedBy TEXT,
    removalReason TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_punishments_executor ON punishments(executorId);
CREATE INDEX IF NOT EXISTS idx_punishments_user ON punishments(userId);
CREATE INDEX IF NOT EXISTS idx_punishments_guild ON punishments(guildId);
CREATE INDEX IF NOT EXISTS idx_punishments_active ON punishments(active);
CREATE INDEX IF NOT EXISTS idx_punishments_applied_at ON punishments(appliedAt);
CREATE INDEX IF NOT EXISTS idx_punishments_type ON punishments(punishmentType);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_punishments_executor_guild ON punishments(executorId, guildId);
CREATE INDEX IF NOT EXISTS idx_punishments_user_guild ON punishments(userId, guildId);
CREATE INDEX IF NOT EXISTS idx_punishments_executor_active ON punishments(executorId, active);
CREATE INDEX IF NOT EXISTS idx_punishments_user_active ON punishments(userId, active);

-- Create trigger to update updatedAt timestamp
CREATE TRIGGER IF NOT EXISTS update_punishments_timestamp 
    AFTER UPDATE ON punishments
    FOR EACH ROW
BEGIN
    UPDATE punishments SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
