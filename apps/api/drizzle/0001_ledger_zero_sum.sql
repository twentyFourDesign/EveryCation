-- The entries of every ledger transaction must add up to zero.
-- Checked once at commit, so a transaction can insert its entries in any order.
CREATE FUNCTION ledger_check_zero_sum() RETURNS trigger AS $$
DECLARE total bigint;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF total <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % does not balance (sum %)', NEW.transaction_id, total USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_entries_zero_sum AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_check_zero_sum();
--> statement-breakpoint
-- The ledger is append-only: corrections are new transactions, never edits.
CREATE FUNCTION ledger_forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION ledger_forbid_change();
--> statement-breakpoint
-- The system accounts every environment needs.
INSERT INTO ledger_accounts (kind, allow_negative) VALUES
  ('partner_float', true), ('payout_clearing', false), ('platform_fees', false), ('card_clearing', true);
