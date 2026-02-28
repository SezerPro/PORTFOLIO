insert into public.admins (email)
values
    ('sezer.dogan.pro@gmail.com'),
    ('dogan.sezer@hotmail.fr')
on conflict (email) do nothing;
