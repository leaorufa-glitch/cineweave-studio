-- Additive immutable compiled inputs. Existing Runs and media remain untouched.
CREATE TABLE IF NOT EXISTS h3_compilations (
 id UUID PRIMARY KEY,
 clip_id UUID NOT NULL REFERENCES generation_clips(id),
 clip_version INTEGER NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('T2VA','I2VA','FL2VA','L2VA','Ref2VA')),
 provider TEXT NOT NULL,
 rules_version TEXT NOT NULL,
 hash TEXT NOT NULL CHECK(length(hash)=64),
 compiled_prompt TEXT NOT NULL,
 reference_map JSONB NOT NULL,
 source_snapshot JSONB NOT NULL,
 validation JSONB NOT NULL,
 input_snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(clip_id,hash)
);
ALTER TABLE video_runs ADD COLUMN IF NOT EXISTS compiled_input_id UUID REFERENCES h3_compilations(id);
CREATE INDEX IF NOT EXISTS ix_h3_compilations_clip ON h3_compilations(clip_id,created_at DESC);
