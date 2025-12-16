-- Migration: 006_add_replicas_to_services
-- Description: Add replicas column to services table for scaling support

ALTER TABLE services ADD COLUMN replicas INTEGER DEFAULT 1 CHECK (replicas >= 1 AND replicas <= 3);
