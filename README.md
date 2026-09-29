# Evaluasi Sampah

jalankan semua yang ada di markdown ini, jika tidak selesai maka bagi menjadi beberapa part

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://evaluasisampah.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ee69023e-7bd8-49c9-a864-8c96b2094a48).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Database Setup

The application uses Supabase PostgreSQL. Set `LOVABLE_DB_MIGRATION_URL` to a
database connection string in the local environment, then apply the checked-in
Drizzle migrations:

```powershell
$env:LOVABLE_DB_MIGRATION_URL = "<database-connection-string>"
bun run db:migrate
```

Never commit the connection string. Configure the client-side Supabase URL and
publishable key using the deployment environment's `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` settings.

Public signup creates a `teacher` account. To bootstrap the first super admin,
first create and confirm the account through the app, then run this once in the
Supabase SQL editor using that account's email:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'admin@example.org'
ON CONFLICT (user_id, role) DO NOTHING;
```

School administrators can then assign roles to users already attached to their
school. A user must be assigned a school through `profiles.school_id` before
they can record school data.
