-- Migration: Ensure admin users have full access to all features
-- Admin users should bypass subscription checks

-- 1. Add is_admin column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 2. Create index for admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- 3. Add is_admin_grant column to subscriptions if it doesn't exist
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS is_admin_grant boolean DEFAULT false;

-- 4. Create index for admin grants
CREATE INDEX IF NOT EXISTS idx_subscriptions_admin_grant ON subscriptions(is_admin_grant) WHERE is_admin_grant = true;

-- 5. Function to automatically grant admin subscription when is_admin is set
CREATE OR REPLACE FUNCTION grant_admin_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- If user is marked as admin, ensure they have admin subscription
    IF NEW.is_admin = true THEN
        INSERT INTO subscriptions (
            user_id,
            plan_id,
            plan_name,
            status,
            current_period_start,
            current_period_end,
            is_admin_grant,
            granted_by,
            grant_reason,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            'admin',
            'ADMIN',
            'active',
            now(),
            now() + interval '100 years', -- Effectively permanent
            true,
            NEW.id, -- Self-granted
            'Admin user - automatic grant',
            now(),
            now()
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
            plan_id = 'admin',
            plan_name = 'ADMIN',
            status = 'active',
            is_admin_grant = true,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger to auto-grant admin subscription
DROP TRIGGER IF EXISTS auto_grant_admin_subscription ON profiles;
CREATE TRIGGER auto_grant_admin_subscription
    AFTER INSERT OR UPDATE OF is_admin ON profiles
    FOR EACH ROW
    WHEN (NEW.is_admin = true)
    EXECUTE FUNCTION grant_admin_subscription();

-- 7. Update existing admin users (if any)
-- This will trigger the function above for existing admins
UPDATE profiles SET is_admin = is_admin WHERE is_admin = true;

-- 8. Add comment documentation
COMMENT ON COLUMN profiles.is_admin IS 'Admin users have full access to all features regardless of subscription';
COMMENT ON COLUMN subscriptions.is_admin_grant IS 'Subscription was granted by admin, not purchased';
COMMENT ON FUNCTION grant_admin_subscription() IS 'Automatically grants admin subscription when user is marked as admin';
