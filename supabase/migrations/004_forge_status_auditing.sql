-- Forge: Add the 'auditing' status to support the new Digital Presence Audit stage.
-- Stage order: pending → researching → auditing → analyzing → pricing → complete | error

ALTER TABLE forge_analyses
  DROP CONSTRAINT IF EXISTS forge_analyses_status_check;

ALTER TABLE forge_analyses
  ADD CONSTRAINT forge_analyses_status_check
  CHECK (status IN ('pending', 'researching', 'auditing', 'analyzing', 'pricing', 'complete', 'error'));
