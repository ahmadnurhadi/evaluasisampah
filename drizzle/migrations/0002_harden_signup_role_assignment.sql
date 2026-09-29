-- Public signup metadata is user-controlled. New accounts must never be able
-- to choose a privileged role; elevated roles are assigned by an administrator.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;