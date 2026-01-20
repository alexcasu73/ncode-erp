-- ============================================
-- CREATE USER INVITATIONS TABLE
-- ============================================
-- Table to store magic link tokens for user invitations
-- ============================================

CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_user_id ON user_invitations(user_id);
CREATE INDEX idx_user_invitations_expires_at ON user_invitations(expires_at);

-- RLS Policies
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view their own invitations by email (before user_id is set)
CREATE POLICY "Users can view invitations by email"
ON user_invitations
FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR user_id = auth.uid()
);

-- Only service role can insert (done server-side)
-- No UPDATE or DELETE policies needed (handled server-side)

-- Trigger to update updated_at
CREATE TRIGGER update_user_invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE user_invitations IS
'Stores magic link tokens for user invitations. Tokens expire after 7 days.
Used_at is set when the invitation is completed.';
