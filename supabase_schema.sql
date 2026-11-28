-- ============================================================
-- PROYECTO EXLIBRIS - ESQUEMA DE BASE DE DATOS SUPABASE (POSTGRESQL)
-- ============================================================

-- 1. HABILITAR EXTENSIONES
create extension if not exists "uuid-ossp";

-- 2. TABLA: rol
create table if not exists public.rol (
    id_rol uuid primary key default gen_random_uuid(),
    nombre_rol varchar(20) not null unique
);

-- Inserción de roles iniciales
insert into public.rol (nombre_rol) values 
    ('cliente'),
    ('admin')
on conflict (nombre_rol) do nothing;

-- 3. TABLA: usuario (vinculada a Supabase Auth)
create table if not exists public.usuario (
    id_usuario uuid primary key references auth.users(id) on delete cascade,
    id_rol uuid references public.rol(id_rol) on delete set null,
    nombre_usuario text not null,
    email text not null,
    creado_el timestamptz default now()
);

-- 4. TABLA: libros (Catálogo de obras)
create table if not exists public.libros (
    isbn varchar(20) primary key,
    titulo text not null,
    autor text not null,
    sinopsis text,
    portada_url text,
    total_paginas integer not null check (total_paginas > 0),
    editorial text,
    anio integer
);

alter table public.libros add column if not exists editorial text;
alter table public.libros add column if not exists anio integer;

-- 5. TABLA: biblioteca_usuario (Inventario personal y Bitácora de Compra)
create table if not exists public.biblioteca_usuario (
    id_biblioteca uuid primary key default gen_random_uuid(),
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    isbn varchar(20) not null references public.libros(isbn) on delete cascade,
    estado text not null check (estado in ('leyendo', 'por_leer', 'leido')),
    pagina_actual integer default 0 check (pagina_actual >= 0),
    lugar_compra text,
    precio_compra numeric(10,2) default 0,
    fecha_compra date,
    formato_edicion text,
    actualizado_el timestamptz default now(),
    unique(id_usuario, isbn)
);

-- 6. TABLA: resenas (Muro comunitario)
create table if not exists public.resenas (
    id_resena uuid primary key default gen_random_uuid(),
    isbn varchar(20) not null references public.libros(isbn) on delete cascade,
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    calificacion smallint not null check (calificacion between 1 and 5),
    comentario text not null,
    estado text not null default 'publicado' check (estado in ('publicado', 'eliminado', 'pendiente')),
    creado_el timestamptz default now()
);

-- 7. TABLA: reportes (Moderación de comentarios)
create table if not exists public.reportes (
    id_reporte uuid primary key default gen_random_uuid(),
    id_resena uuid not null references public.resenas(id_resena) on delete cascade,
    id_respuesta uuid,
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    motivo text not null,
    tipo_comentario text not null default 'resena',
    estado text not null default 'pendiente' check (estado in ('pendiente', 'descartado', 'atendido')),
    creado_el timestamptz default now(),
    revisado_el timestamptz,
    constraint reportes_tipo_comentario_check check (tipo_comentario in ('resena', 'respuesta'))
);

create table if not exists public.solicitudes_libro (
    id_solicitud uuid primary key default gen_random_uuid(),
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    id_libro varchar(20) references public.libros(isbn),
    isbn varchar(20) not null,
    tipo text not null check (tipo in ('nuevo', 'actualizacion')),
    datos_propuestos jsonb not null check (jsonb_typeof(datos_propuestos) = 'object'),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
    id_moderador uuid references public.usuario(id_usuario) on delete set null,
    nota_moderador text,
    creado_el timestamptz not null default now(),
    revisado_el timestamptz,
    check (
        (tipo = 'nuevo' and id_libro is null)
        or (tipo = 'actualizacion' and id_libro is not null and id_libro = isbn)
    )
);

create unique index if not exists solicitudes_libro_una_pendiente_por_usuario
    on public.solicitudes_libro (id_usuario, isbn)
    where estado = 'pendiente';

create index if not exists solicitudes_libro_pendientes_fecha
    on public.solicitudes_libro (creado_el desc)
    where estado = 'pendiente';

create table if not exists public.contacto_app (
    id_contacto uuid primary key default gen_random_uuid(),
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    tipo text not null check (tipo in ('recomendacion', 'queja', 'mejora')),
    mensaje text not null check (length(trim(mensaje)) between 10 and 2000),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'atendido')),
    id_moderador uuid references public.usuario(id_usuario) on delete set null,
    creado_el timestamptz not null default now(),
    revisado_el timestamptz
);

create index if not exists contacto_app_pendientes_fecha
    on public.contacto_app (creado_el asc)
    where estado = 'pendiente';

-- 8. TABLA: categorias (Catálogo administrable desde Supabase)
create table if not exists public.categorias (
    id_categoria uuid primary key default gen_random_uuid(),
    nombre_categoria text not null unique check (length(trim(nombre_categoria)) > 0)
);

drop policy if exists "Cualquiera puede leer categorías activas" on public.categorias;
alter table public.categorias drop column if exists descripcion;
alter table public.categorias drop column if exists activo;
alter table public.categorias drop column if exists creado_el;
alter table public.categorias drop column if exists actualizado_el;

create table if not exists public.libro_categorias (
    isbn varchar(20) not null references public.libros(isbn) on delete cascade,
    id_categoria uuid not null references public.categorias(id_categoria) on delete cascade,
    primary key (isbn, id_categoria)
);

-- ============================================================
-- FUNCIÓN HELPER: Verificación de Rol Moderador
-- ============================================================
create or replace function public.is_moderator()
returns boolean as $$
declare
    v_rol text;
begin
    select r.nombre_rol into v_rol
    from public.usuario u
    join public.rol r on u.id_rol = r.id_rol
    where u.id_usuario = auth.uid();
    
    return coalesce(v_rol in ('moderador', 'admin', 'administrador'), false);
end;
$$ language plpgsql security definer;

-- ============================================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
alter table public.rol enable row level security;
alter table public.usuario enable row level security;
alter table public.libros enable row level security;
alter table public.biblioteca_usuario enable row level security;
alter table public.resenas enable row level security;
alter table public.reportes enable row level security;
alter table public.solicitudes_libro enable row level security;
alter table public.contacto_app enable row level security;
alter table public.categorias enable row level security;
alter table public.libro_categorias enable row level security;

-- Migrar proyectos que todavía guardan una categoría de texto en libros.
do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'libros'
          and column_name = 'categoria'
    ) then
        execute $migration$
            insert into public.categorias (nombre_categoria)
            select distinct trim(etiqueta)
            from public.libros
            cross join lateral regexp_split_to_table(categoria, '\s*[,/|]\s*') as parts(etiqueta)
            where categoria is not null and length(trim(etiqueta)) > 0
            on conflict (nombre_categoria) do nothing
        $migration$;

        execute $migration$
            insert into public.libro_categorias (isbn, id_categoria)
            select l.isbn, c.id_categoria
            from public.libros l
            cross join lateral regexp_split_to_table(l.categoria, '\s*[,/|]\s*') as parts(etiqueta)
            join public.categorias c on c.nombre_categoria = trim(etiqueta)
            where l.categoria is not null and length(trim(etiqueta)) > 0
            on conflict (isbn, id_categoria) do nothing
        $migration$;

        alter table public.libros drop column categoria;
    end if;
end;
$$;

-- Políticas para 'rol' y 'libros' (Lectura pública)
create policy "Cualquiera puede leer roles" on public.rol for select using (true);
create policy "Cualquiera puede consultar el catálogo de libros" on public.libros for select using (true);
create policy "Usuarios autenticados pueden registrar libros" on public.libros for insert with check (auth.role() = 'authenticated');

-- Políticas para categorías y relaciones: el catálogo es público y admin lo administra.
grant select on public.categorias, public.libro_categorias to anon;
grant select, insert, update, delete on public.categorias, public.libro_categorias to authenticated;

drop policy if exists "Cualquiera puede leer categorías" on public.categorias;
create policy "Cualquiera puede leer categorías"
    on public.categorias for select
    to anon, authenticated
    using (true);

drop policy if exists "Administradores gestionan categorías" on public.categorias;
create policy "Administradores gestionan categorías"
    on public.categorias for all
    to authenticated
    using (public.is_moderator())
    with check (public.is_moderator());

drop policy if exists "Cualquiera puede leer relaciones de categorías" on public.libro_categorias;
create policy "Cualquiera puede leer relaciones de categorías"
    on public.libro_categorias for select
    to anon, authenticated
    using (true);

drop policy if exists "Usuarios autenticados asignan categorías a libros" on public.libro_categorias;
create policy "Usuarios autenticados asignan categorías a libros"
    on public.libro_categorias for insert
    to authenticated
    with check (true);

drop policy if exists "Administradores actualizan relaciones de categorías" on public.libro_categorias;
create policy "Administradores actualizan relaciones de categorías"
    on public.libro_categorias for update
    to authenticated
    using (public.is_moderator())
    with check (public.is_moderator());

drop policy if exists "Administradores eliminan relaciones de categorías" on public.libro_categorias;
create policy "Administradores eliminan relaciones de categorías"
    on public.libro_categorias for delete
    to authenticated
    using (public.is_moderator());

-- Políticas para 'usuario'
grant update (nombre_usuario) on public.usuario to authenticated;
create policy "Usuarios pueden ver perfiles" on public.usuario for select using (true);
create policy "Usuarios editan su propio perfil" on public.usuario for update using (auth.uid() = id_usuario);

-- Políticas para 'biblioteca_usuario' (Personal de cada usuario)
create policy "Usuarios gestionan su propia biblioteca (SELECT)" 
    on public.biblioteca_usuario for select using (auth.uid() = id_usuario);

create policy "Usuarios agregan a su propia biblioteca (INSERT)" 
    on public.biblioteca_usuario for insert with check (auth.uid() = id_usuario);

create policy "Usuarios actualizan sus lecturas y bitácora (UPDATE)" 
    on public.biblioteca_usuario for update using (auth.uid() = id_usuario);

create policy "Usuarios eliminan tomos de su biblioteca (DELETE)" 
    on public.biblioteca_usuario for delete using (auth.uid() = id_usuario);

-- Políticas para 'resenas'
create policy "Cualquiera puede leer reseñas publicadas" 
    on public.resenas for select using (estado = 'publicado' or public.is_moderator());

create policy "Usuarios autenticados pueden publicar reseñas" 
    on public.resenas for insert with check (auth.uid() = id_usuario and estado = 'publicado');

create policy "Moderadores pueden moderar o eliminar reseñas" 
    on public.resenas for update using (public.is_moderator() or auth.uid() = id_usuario);

-- Políticas para 'reportes'
create policy "Usuarios autenticados pueden enviar reportes" 
    on public.reportes for insert with check (auth.uid() = id_usuario);

create policy "Solo moderadores auditan reportes" 
    on public.reportes for select using (public.is_moderator());

create policy "Solo moderadores actualizan estado de reportes" 
    on public.reportes for update using (public.is_moderator());

-- Políticas para las solicitudes de incorporación y actualización de libros
grant select, insert on public.solicitudes_libro to authenticated;

drop policy if exists "Lectores ven sus solicitudes y moderadores todas" on public.solicitudes_libro;
create policy "Lectores ven sus solicitudes y moderadores todas"
    on public.solicitudes_libro for select
    to authenticated
    using (auth.uid() = id_usuario or public.is_moderator());

drop policy if exists "Lectores envían solicitudes propias pendientes" on public.solicitudes_libro;
create policy "Lectores envían solicitudes propias pendientes"
    on public.solicitudes_libro for insert
    to authenticated
    with check (
        auth.uid() = id_usuario
        and estado = 'pendiente'
        and id_moderador is null
        and revisado_el is null
    );

grant select, insert, update on public.contacto_app to authenticated;

drop policy if exists "Usuarios ven sus mensajes y moderadores todos" on public.contacto_app;
create policy "Usuarios ven sus mensajes y moderadores todos"
    on public.contacto_app for select
    to authenticated
    using (auth.uid() = id_usuario or public.is_moderator());

drop policy if exists "Usuarios envían mensajes propios pendientes" on public.contacto_app;
create policy "Usuarios envían mensajes propios pendientes"
    on public.contacto_app for insert
    to authenticated
    with check (
        auth.uid() = id_usuario
        and estado = 'pendiente'
        and id_moderador is null
        and revisado_el is null
    );

drop policy if exists "Moderadores actualizan mensajes de contacto" on public.contacto_app;
create policy "Moderadores actualizan mensajes de contacto"
    on public.contacto_app for update
    to authenticated
    using (public.is_moderator())
    with check (public.is_moderator());

create or replace function public.resolver_contacto_app(p_id_contacto uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_moderator() then
        raise exception 'Solo moderadores pueden atender mensajes de contacto';
    end if;

    update public.contacto_app
    set estado = 'atendido',
        id_moderador = auth.uid(),
        revisado_el = now()
    where id_contacto = p_id_contacto
      and estado = 'pendiente';

    if not found then
        raise exception 'El mensaje no existe o ya fue atendido';
    end if;
end;
$$;

revoke all on function public.resolver_contacto_app(uuid) from public;
grant execute on function public.resolver_contacto_app(uuid) to authenticated;

create or replace function public.revisar_solicitud_libro(
    p_id_solicitud uuid,
    p_accion text,
    p_campos_aprobados text[] default '{}',
    p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_solicitud public.solicitudes_libro%rowtype;
    v_categoria text;
    v_titulo text;
    v_autor text;
    v_paginas integer;
    v_anio integer;
begin
    if not public.is_moderator() then
        raise exception 'Solo moderadores pueden revisar solicitudes de libros';
    end if;

    if p_accion is null or p_accion not in ('aprobar', 'rechazar') then
        raise exception 'Acción de moderación inválida';
    end if;

    select *
    into v_solicitud
    from public.solicitudes_libro
    where id_solicitud = p_id_solicitud
    for update;

    if not found or v_solicitud.estado <> 'pendiente' then
        raise exception 'La solicitud no existe o ya fue revisada';
    end if;

    if p_accion = 'rechazar' then
        update public.solicitudes_libro
        set estado = 'rechazada',
            id_moderador = auth.uid(),
            nota_moderador = nullif(trim(p_nota), ''),
            revisado_el = now()
        where id_solicitud = p_id_solicitud;
        return;
    end if;

    if coalesce(cardinality(p_campos_aprobados), 0) = 0
       or exists (
           select 1
           from unnest(p_campos_aprobados) campo
           where campo not in ('titulo', 'autor', 'editorial', 'anio', 'total_paginas', 'sinopsis', 'portada_url', 'categorias')
       ) then
        raise exception 'Selecciona campos válidos para aplicar';
    end if;

    if 'total_paginas' = any(p_campos_aprobados) then
        if coalesce(v_solicitud.datos_propuestos->>'total_paginas', '') !~ '^[1-9][0-9]*$' then
            raise exception 'La cantidad de páginas propuesta no es válida';
        end if;
        v_paginas := (v_solicitud.datos_propuestos->>'total_paginas')::integer;
    end if;

    if 'anio' = any(p_campos_aprobados) then
        if coalesce(v_solicitud.datos_propuestos->>'anio', '') !~ '^[0-9]{4}$' then
            raise exception 'El año propuesto no es válido';
        end if;
        v_anio := (v_solicitud.datos_propuestos->>'anio')::integer;
    end if;

    if 'portada_url' = any(p_campos_aprobados)
       and coalesce(v_solicitud.datos_propuestos->>'portada_url', '') !~* '^https://[^[:space:]]+$' then
        raise exception 'La URL de portada debe usar HTTPS';
    end if;

    if 'categorias' = any(p_campos_aprobados) then
        if coalesce(jsonb_typeof(v_solicitud.datos_propuestos->'id_categorias'), 'null') <> 'array' then
            raise exception 'La lista de categorías propuesta no es válida';
        end if;
        for v_categoria in
            select proposed_category.id_categoria
            from jsonb_array_elements_text(v_solicitud.datos_propuestos->'id_categorias')
                as proposed_category(id_categoria)
        loop
            if not exists (
                select 1 from public.categorias where id_categoria::text = v_categoria
            ) then
                raise exception 'Una categoría propuesta ya no existe';
            end if;
        end loop;
    end if;

    if v_solicitud.tipo = 'nuevo' then
        if not ('titulo' = any(p_campos_aprobados) and 'autor' = any(p_campos_aprobados)) then
            raise exception 'Para incorporar un libro deben aprobarse el título y el autor';
        end if;

        v_titulo := nullif(trim(v_solicitud.datos_propuestos->>'titulo'), '');
        v_autor := nullif(trim(v_solicitud.datos_propuestos->>'autor'), '');
        if v_titulo is null or v_autor is null then
            raise exception 'El título y el autor son obligatorios';
        end if;

        insert into public.libros (
            isbn, titulo, autor, editorial, anio, sinopsis, portada_url, total_paginas
        )
        values (
            v_solicitud.isbn,
            v_titulo,
            v_autor,
            case when 'editorial' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'editorial'), '') end,
            case when 'anio' = any(p_campos_aprobados) then v_anio end,
            case when 'sinopsis' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'sinopsis'), '') end,
            case when 'portada_url' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'portada_url'), '') end,
            case when 'total_paginas' = any(p_campos_aprobados) then v_paginas else 250 end
        );
    else
        update public.libros
        set titulo = case when 'titulo' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'titulo'), '') else titulo end,
            autor = case when 'autor' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'autor'), '') else autor end,
            editorial = case when 'editorial' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'editorial'), '') else editorial end,
            anio = case when 'anio' = any(p_campos_aprobados) then v_anio else anio end,
            sinopsis = case when 'sinopsis' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'sinopsis'), '') else sinopsis end,
            portada_url = case when 'portada_url' = any(p_campos_aprobados) then nullif(trim(v_solicitud.datos_propuestos->>'portada_url'), '') else portada_url end,
            total_paginas = case when 'total_paginas' = any(p_campos_aprobados) then v_paginas else total_paginas end
        where isbn = v_solicitud.id_libro;

        if not found then
            raise exception 'El libro asociado a la solicitud ya no existe';
        end if;
    end if;

    if 'categorias' = any(p_campos_aprobados) then
        delete from public.libro_categorias
        where isbn = v_solicitud.isbn;

        insert into public.libro_categorias (isbn, id_categoria)
        select distinct v_solicitud.isbn, proposed_category.id_categoria::uuid
        from jsonb_array_elements_text(v_solicitud.datos_propuestos->'id_categorias')
            as proposed_category(id_categoria);
    end if;

    update public.solicitudes_libro
    set estado = 'aprobada',
        id_moderador = auth.uid(),
        nota_moderador = nullif(trim(p_nota), ''),
        revisado_el = now()
    where id_solicitud = p_id_solicitud;
end;
$$;

revoke all on function public.revisar_solicitud_libro(uuid, text, text[], text) from public;
grant execute on function public.revisar_solicitud_libro(uuid, text, text[], text) to authenticated;

-- ============================================================
-- TRIGGER: Creación automática de perfil al registrarse en Auth
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
    v_default_rol uuid;
begin
    select id_rol into v_default_rol from public.rol where nombre_rol = 'cliente' limit 1;

    insert into public.usuario (id_usuario, id_rol, nombre_usuario, email)
    values (
        new.id,
        v_default_rol,
        coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
        new.email
    );
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create or replace function public.sync_usuario_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.email is not null and new.email is distinct from old.email then
        update public.usuario
        set email = new.email
        where id_usuario = new.id;
    end if;
    return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
    after update of email on auth.users
    for each row execute function public.sync_usuario_email();

-- ============================================================
-- SEED DATA: Obras Literarias Iniciales del Proyecto ExLibris
-- ============================================================
insert into public.libros (isbn, titulo, autor, sinopsis, portada_url, total_paginas)
values
(
    '9788437604947',
    'Cien años de soledad',
    'Gabriel García Márquez',
    'Muchos años después, frente al pelotón de fusilamiento, el coronel Aureliano Buendía había de recordar aquella tarde remota en que su padre lo llevó a conocer el hielo.',
    'https://images.cdn1.buscalibre.com/fit-in/360x360/61/8d/618d227e8962453549725f0a3e83bf59.jpg',
    471
),
(
    '9788420658421',
    'Ficciones',
    'Jorge Luis Borges',
    'Obra cumbre de Borges con laberintos, libros infinitos y espejos como La biblioteca de Babel y El jardín de senderos que se bifurcan.',
    'https://images.cdn3.buscalibre.com/fit-in/360x360/4c/33/4c33083c261e4799da8913b4ca6d58dc.jpg',
    176
),
(
    '9788401341991',
    'La casa de los espíritus',
    'Isabel Allende',
    'Narra la historia de cuatro generaciones de la familia Trueba en medio de las convulsiones sociales y políticas de Chile y Latinoamérica.',
    'https://images.cdn2.buscalibre.com/fit-in/360x360/e2/2e/e22ee513be825121b61c77f0a149cbe7.jpg',
    496
),
(
    '9788408043645',
    'La sombra del viento',
    'Carlos Ruiz Zafón',
    'Un amanecer de 1945 en Barcelona, Daniel Sempere descubre El Cementerio de los Libros Olvidados y una intriga literaria fascinante.',
    'https://images.cdn1.buscalibre.com/fit-in/360x360/a0/0b/a00b01c342f2b38f8cfceebf581fe412.jpg',
    576
),
(
    '9788437604183',
    'Pedro Páramo',
    'Juan Rulfo',
    'Vine a Comala porque me dijeron que acá vivía mi padre, un tal Pedro Páramo. Una obra maestra sobre los fantasmas del pasado.',
    'https://images.cdn3.buscalibre.com/fit-in/360x360/96/8c/968c347f78c93b36cf530e1f7c5e2634.jpg',
    130
),
(
    '9788437604572',
    'Rayuela',
    'Julio Cortázar',
    'Una contranovela revolucionaria protagonizada por Horacio Oliveira y la Maga entre París y Buenos Aires.',
    'https://images.cdn2.buscalibre.com/fit-in/360x360/68/b2/68b209e51c890635ef8c8193855ff4bb.jpg',
    720
)
on conflict (isbn) do nothing;

insert into public.categorias (nombre_categoria)
values
    ('Realismo Mágico'),
    ('Ficción'),
    ('Filosofía'),
    ('Novela'),
    ('Novela Histórica'),
    ('Misterio'),
    ('Clásicos'),
    ('Ficción Experimental')
on conflict (nombre_categoria) do nothing;

insert into public.libro_categorias (isbn, id_categoria)
select mapping.isbn, categorias.id_categoria
from (values
    ('9788437604947', 'Realismo Mágico'),
    ('9788437604947', 'Novela'),
    ('9788420658421', 'Ficción'),
    ('9788420658421', 'Filosofía'),
    ('9788401341991', 'Novela Histórica'),
    ('9788401341991', 'Novela'),
    ('9788408043645', 'Misterio'),
    ('9788408043645', 'Novela'),
    ('9788437604183', 'Clásicos'),
    ('9788437604183', 'Novela'),
    ('9788437604572', 'Ficción Experimental'),
    ('9788437604572', 'Novela')
) as mapping(isbn, nombre_categoria)
join public.categorias on categorias.nombre_categoria = mapping.nombre_categoria
on conflict (isbn, id_categoria) do nothing;

-- ============================================================
-- 9. TABLA: resena_likes (Likes en comentarios comunitarios)
-- ============================================================
create table if not exists public.resena_likes (
    id_resena uuid not null references public.resenas(id_resena) on delete cascade,
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    creado_el timestamptz default now(),
    primary key (id_resena, id_usuario)
);

alter table public.resena_likes enable row level security;
grant select, insert, delete on public.resena_likes to authenticated;
grant select on public.resena_likes to anon;

drop policy if exists "Cualquiera puede leer likes" on public.resena_likes;
create policy "Cualquiera puede leer likes" on public.resena_likes for select using (true);

drop policy if exists "Usuarios autenticados dan like" on public.resena_likes;
create policy "Usuarios autenticados dan like" on public.resena_likes for insert with check (auth.uid() = id_usuario);

drop policy if exists "Usuarios autenticados retiran su like" on public.resena_likes;
create policy "Usuarios autenticados retiran su like" on public.resena_likes for delete using (auth.uid() = id_usuario);

-- ============================================================
-- 10. TABLA: resena_respuestas (Comentarios a otros comentarios)
-- ============================================================
create table if not exists public.resena_respuestas (
    id_respuesta uuid primary key default gen_random_uuid(),
    id_resena uuid not null references public.resenas(id_resena) on delete cascade,
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    id_respuesta_padre uuid references public.resena_respuestas(id_respuesta) on delete cascade,
    comentario text not null,
    creado_el timestamptz default now()
);

alter table public.reportes
    add column if not exists id_respuesta uuid,
    add column if not exists tipo_comentario text not null default 'resena';

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'reportes_tipo_comentario_check'
          and conrelid = 'public.reportes'::regclass
    ) then
        alter table public.reportes
            add constraint reportes_tipo_comentario_check
            check (tipo_comentario in ('resena', 'respuesta'));
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'reportes_id_respuesta_fkey'
          and conrelid = 'public.reportes'::regclass
    ) then
        alter table public.reportes
            add constraint reportes_id_respuesta_fkey
            foreign key (id_respuesta)
            references public.resena_respuestas(id_respuesta)
            on delete set null;
    end if;
end;
$$;

drop policy if exists "Usuarios autenticados pueden enviar reportes" on public.reportes;
create or replace function public.respuesta_pertenece_a_resena(
    p_id_respuesta uuid,
    p_id_resena uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.resena_respuestas respuesta
        where respuesta.id_respuesta = p_id_respuesta
          and respuesta.id_resena = p_id_resena
    );
$$;

revoke all on function public.respuesta_pertenece_a_resena(uuid, uuid) from public;
grant execute on function public.respuesta_pertenece_a_resena(uuid, uuid) to authenticated;

create policy "Usuarios autenticados pueden enviar reportes"
    on public.reportes for insert
    to authenticated
    with check (
        auth.uid() = id_usuario
        and estado = 'pendiente'
        and revisado_el is null
        and (
            (tipo_comentario = 'resena' and id_respuesta is null)
            or (
                tipo_comentario = 'respuesta'
                and id_respuesta is not null
                and public.respuesta_pertenece_a_resena(id_respuesta, id_resena)
            )
        )
    );

create or replace function public.crear_reporte_comentario(
    p_id_resena uuid,
    p_id_respuesta uuid,
    p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id_usuario uuid := auth.uid();
    v_id_usuario_objetivo uuid;
    v_id_reporte uuid;
begin
    if v_id_usuario is null then
        raise exception 'Inicia sesión para enviar un reporte.';
    end if;

    if nullif(pg_catalog.btrim(p_motivo), '') is null then
        raise exception 'Selecciona un motivo para el reporte.';
    end if;

    if p_id_respuesta is null then
        select resena.id_usuario
        into v_id_usuario_objetivo
        from public.resenas resena
        where resena.id_resena = p_id_resena
          and resena.estado = 'publicado';
    else
        select respuesta.id_usuario
        into v_id_usuario_objetivo
        from public.resena_respuestas respuesta
        join public.resenas resena on resena.id_resena = respuesta.id_resena
        where respuesta.id_respuesta = p_id_respuesta
          and respuesta.id_resena = p_id_resena
          and resena.estado = 'publicado';
    end if;

    if not found then
        raise exception 'El comentario que intentas reportar ya no existe.';
    end if;

    if v_id_usuario_objetivo = v_id_usuario then
        raise exception 'No puedes reportar tu propio comentario.';
    end if;

    insert into public.reportes (
        id_resena,
        id_respuesta,
        id_usuario,
        motivo,
        tipo_comentario,
        estado
    )
    values (
        p_id_resena,
        p_id_respuesta,
        v_id_usuario,
        pg_catalog.btrim(p_motivo),
        case when p_id_respuesta is null then 'resena' else 'respuesta' end,
        'pendiente'
    )
    returning id_reporte into v_id_reporte;

    return v_id_reporte;
end;
$$;

revoke all on function public.crear_reporte_comentario(uuid, uuid, text) from public;
grant execute on function public.crear_reporte_comentario(uuid, uuid, text) to authenticated;

alter table public.resena_respuestas
    add column if not exists id_respuesta_padre uuid references public.resena_respuestas(id_respuesta) on delete cascade;

alter table public.resena_respuestas enable row level security;
grant select, insert, delete on public.resena_respuestas to authenticated;
grant select on public.resena_respuestas to anon;

drop policy if exists "Cualquiera puede leer respuestas a comentarios" on public.resena_respuestas;
create policy "Cualquiera puede leer respuestas a comentarios" on public.resena_respuestas for select using (true);

drop policy if exists "Usuarios autenticados pueden responder" on public.resena_respuestas;
create policy "Usuarios autenticados pueden responder" on public.resena_respuestas for insert with check (auth.uid() = id_usuario);

drop policy if exists "Autores o moderadores pueden eliminar respuestas" on public.resena_respuestas;
create policy "Autores o moderadores pueden eliminar respuestas" on public.resena_respuestas for delete using (auth.uid() = id_usuario or public.is_moderator());

create or replace function public.resolver_reporte_moderacion(
    p_id_reporte uuid,
    p_accion text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_reporte public.reportes%rowtype;
begin
    if not public.is_moderator() then
        raise exception 'Solo moderadores pueden resolver reportes';
    end if;

    if p_accion is null or p_accion not in ('conservar', 'eliminar') then
        raise exception 'Acción de moderación inválida';
    end if;

    select *
    into v_reporte
    from public.reportes
    where id_reporte = p_id_reporte
    for update;

    if not found or v_reporte.estado <> 'pendiente' then
        raise exception 'El reporte no existe o ya fue revisado';
    end if;

    if p_accion = 'eliminar' then
        if v_reporte.tipo_comentario = 'respuesta' then
            if v_reporte.id_respuesta is null then
                raise exception 'La respuesta reportada ya no existe';
            end if;

            delete from public.resena_respuestas
            where id_respuesta = v_reporte.id_respuesta
              and id_resena = v_reporte.id_resena;

            if not found then
                raise exception 'La respuesta reportada ya no existe';
            end if;
        else
            update public.resenas
            set estado = 'eliminado'
            where id_resena = v_reporte.id_resena;

            if not found then
                raise exception 'El comentario reportado ya no existe';
            end if;
        end if;
    end if;

    update public.reportes
    set estado = case when p_accion = 'conservar' then 'descartado' else 'atendido' end,
        revisado_el = now()
    where id_reporte = p_id_reporte;
end;
$$;

revoke all on function public.resolver_reporte_moderacion(uuid, text) from public;
grant execute on function public.resolver_reporte_moderacion(uuid, text) to authenticated;

create table if not exists public.respuesta_likes (
    id_respuesta uuid not null references public.resena_respuestas(id_respuesta) on delete cascade,
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    creado_el timestamptz default now(),
    primary key (id_respuesta, id_usuario)
);

alter table public.respuesta_likes enable row level security;
grant select, insert, delete on public.respuesta_likes to authenticated;
grant select on public.respuesta_likes to anon;

drop policy if exists "Cualquiera puede leer likes de respuestas" on public.respuesta_likes;
create policy "Cualquiera puede leer likes de respuestas" on public.respuesta_likes for select using (true);

drop policy if exists "Usuarios autenticados dan like a respuestas" on public.respuesta_likes;
create policy "Usuarios autenticados dan like a respuestas" on public.respuesta_likes for insert with check (auth.uid() = id_usuario);

drop policy if exists "Usuarios autenticados retiran su like de respuestas" on public.respuesta_likes;
create policy "Usuarios autenticados retiran su like de respuestas" on public.respuesta_likes for delete using (auth.uid() = id_usuario);

-- ============================================================
-- 11. TABLA: notificaciones (Centro de notificaciones de usuario)
-- ============================================================
create table if not exists public.notificaciones (
    id_notificacion uuid primary key default gen_random_uuid(),
    id_usuario uuid not null,
    tipo text not null check (tipo in ('like', 'respuesta', 'moderacion', 'sistema')),
    titulo text not null,
    mensaje text not null,
    leida boolean not null default false,
    isbn text,
    id_resena uuid,
    creado_el timestamptz default now()
);

-- Si la tabla ya existía con restricciones de clave foránea que pudieran abortar inserciones, las removemos
alter table public.notificaciones drop constraint if exists notificaciones_isbn_fkey;
alter table public.notificaciones drop constraint if exists notificaciones_id_resena_fkey;
alter table public.notificaciones drop constraint if exists notificaciones_id_usuario_fkey;

alter table public.notificaciones enable row level security;
alter table public.notificaciones replica identity full;

grant all on public.notificaciones to authenticated;
grant all on public.notificaciones to anon;
grant all on public.notificaciones to service_role;

drop policy if exists "Usuarios ven sus propias notificaciones" on public.notificaciones;
create policy "Usuarios ven sus propias notificaciones" on public.notificaciones for select using (auth.uid() = id_usuario or auth.uid() is null);

drop policy if exists "Usuarios actualizan sus notificaciones" on public.notificaciones;
create policy "Usuarios actualizan sus notificaciones" on public.notificaciones for update using (auth.uid() = id_usuario);

drop policy if exists "Usuarios eliminan sus notificaciones" on public.notificaciones;
create policy "Usuarios eliminan sus notificaciones" on public.notificaciones for delete using (auth.uid() = id_usuario);

drop policy if exists "Usuarios o sistema insertan notificaciones" on public.notificaciones;
create policy "Usuarios o sistema insertan notificaciones" on public.notificaciones for insert with check (true);

create or replace function public.notificar_moderadores_revision(
    p_titulo text,
    p_mensaje text
)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.notificaciones (id_usuario, tipo, titulo, mensaje)
    select u.id_usuario, 'moderacion', p_titulo, p_mensaje
    from public.usuario u
    join public.rol r on r.id_rol = u.id_rol
    where lower(trim(r.nombre_rol)) in ('moderador', 'admin', 'administrador');
$$;

revoke all on function public.notificar_moderadores_revision(text, text) from public;

create or replace function public.tr_notificar_solicitud_libro_pendiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.estado = 'pendiente' then
        perform public.notificar_moderadores_revision(
            'Revisión pendiente: solicitud de libro',
            'Hay una propuesta para el ISBN ' || new.isbn || ' que espera revisión.'
        );
    end if;
    return new;
end;
$$;

create or replace function public.tr_notificar_reporte_pendiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.estado = 'pendiente' then
        perform public.notificar_moderadores_revision(
            'Revisión pendiente: reporte comunitario',
            'Un lector envió un reporte que espera revisión de moderación.'
        );
    end if;
    return new;
end;
$$;

create or replace function public.tr_notificar_contacto_pendiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_nombre text;
begin
    if new.estado = 'pendiente' then
        select nombre_usuario into v_nombre
        from public.usuario
        where id_usuario = new.id_usuario;

        perform public.notificar_moderadores_revision(
            'Revisión pendiente: mensaje de contacto',
            coalesce(v_nombre, 'Un lector') || ' envió una ' || new.tipo || ' para la aplicación.'
        );
    end if;
    return new;
end;
$$;

drop trigger if exists tr_notificar_solicitud_libro_moderadores on public.solicitudes_libro;
create trigger tr_notificar_solicitud_libro_moderadores
    after insert on public.solicitudes_libro
    for each row execute function public.tr_notificar_solicitud_libro_pendiente();

drop trigger if exists tr_notificar_reporte_moderadores on public.reportes;
create trigger tr_notificar_reporte_moderadores
    after insert on public.reportes
    for each row execute function public.tr_notificar_reporte_pendiente();

drop trigger if exists tr_notificar_contacto_moderadores on public.contacto_app;
create trigger tr_notificar_contacto_moderadores
    after insert on public.contacto_app
    for each row execute function public.tr_notificar_contacto_pendiente();

insert into public.notificaciones (id_usuario, tipo, titulo, mensaje)
select u.id_usuario,
       'moderacion',
       'Revisión pendiente: pendientes existentes',
       'Hay reportes, propuestas de libros o mensajes de contacto anteriores que esperan revisión.'
from public.usuario u
join public.rol r on r.id_rol = u.id_rol
where lower(trim(r.nombre_rol)) in ('moderador', 'admin', 'administrador')
  and (
      exists (select 1 from public.reportes where estado = 'pendiente')
      or exists (select 1 from public.solicitudes_libro where estado = 'pendiente')
      or exists (select 1 from public.contacto_app where estado = 'pendiente')
  )
  and not exists (
      select 1
      from public.notificaciones n
      where n.id_usuario = u.id_usuario
        and n.tipo = 'moderacion'
        and n.titulo = 'Revisión pendiente: pendientes existentes'
  );

-- ============================================================
-- 12. TRIGGERS AUTOMÁTICOS EN SUPABASE PARA NOTIFICACIONES
-- ============================================================

-- 1. Trigger para LIKE en reseña principal
create or replace function public.tr_notif_resena_like()
returns trigger as $$
declare
    v_target_user uuid;
    v_isbn text;
    v_titulo text;
    v_liker_name text;
begin
    select r.id_usuario, r.isbn, coalesce(l.titulo, 'una obra'), coalesce(u.nombre_usuario, 'Un lector')
    into v_target_user, v_isbn, v_titulo, v_liker_name
    from public.resenas r
    left join public.libros l on l.isbn = r.isbn
    left join public.usuario u on u.id_usuario = new.id_usuario
    where r.id_resena = new.id_resena;

    if v_target_user is not null and v_target_user <> new.id_usuario then
        if not exists (
            select 1 from public.notificaciones
            where id_usuario = v_target_user
              and tipo = 'like'
              and id_resena = new.id_resena
              and creado_el >= now() - interval '1 minute'
        ) then
            insert into public.notificaciones (id_usuario, tipo, titulo, mensaje, isbn, id_resena)
            values (
                v_target_user,
                'like',
                'Nuevo me gusta en tu reseña',
                'A @' || lower(replace(v_liker_name, ' ', '_')) || ' le gustó tu reseña en "' || v_titulo || '".',
                v_isbn,
                new.id_resena
            );
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_on_resena_like on public.resena_likes;
create trigger tr_on_resena_like
    after insert on public.resena_likes
    for each row execute function public.tr_notif_resena_like();

-- 2. Trigger para RESPUESTAS (comentar reseña o responder a un comentario)
create or replace function public.tr_notif_resena_respuesta()
returns trigger as $$
declare
    v_review_user uuid;
    v_parent_user uuid;
    v_isbn text;
    v_titulo text;
    v_author_name text;
begin
    select r.id_usuario, r.isbn, coalesce(l.titulo, 'una obra'), coalesce(u.nombre_usuario, 'Un lector')
    into v_review_user, v_isbn, v_titulo, v_author_name
    from public.resenas r
    left join public.libros l on l.isbn = r.isbn
    left join public.usuario u on u.id_usuario = new.id_usuario
    where r.id_resena = new.id_resena;

    -- Si es respuesta anidada a un comentario padre
    if new.id_respuesta_padre is not null then
        select id_usuario into v_parent_user
        from public.resena_respuestas
        where id_respuesta = new.id_respuesta_padre;

        -- Notificar al autor del comentario padre
        if v_parent_user is not null and v_parent_user <> new.id_usuario then
            insert into public.notificaciones (id_usuario, tipo, titulo, mensaje, isbn, id_resena)
            values (
                v_parent_user,
                'respuesta',
                'Nueva respuesta a tu comentario',
                v_author_name || ' respondió a tu comentario en "' || v_titulo || '": "' || 
                case when length(new.comentario) > 60 then substring(new.comentario from 1 for 60) || '...' else new.comentario end || '"',
                v_isbn,
                new.id_resena
            );
        end if;

        -- Notificar al autor de la reseña original si no es el mismo
        if v_review_user is not null and v_review_user <> new.id_usuario and v_review_user <> v_parent_user then
            insert into public.notificaciones (id_usuario, tipo, titulo, mensaje, isbn, id_resena)
            values (
                v_review_user,
                'respuesta',
                'Nuevo comentario en tu reseña',
                v_author_name || ' comentó en el hilo de "' || v_titulo || '".',
                v_isbn,
                new.id_resena
            );
        end if;
    else
        -- Respuesta directa a la reseña original
        if v_review_user is not null and v_review_user <> new.id_usuario then
            insert into public.notificaciones (id_usuario, tipo, titulo, mensaje, isbn, id_resena)
            values (
                v_review_user,
                'respuesta',
                'Nueva respuesta a tu reseña',
                v_author_name || ' respondió a tu opinión en "' || v_titulo || '": "' || 
                case when length(new.comentario) > 60 then substring(new.comentario from 1 for 60) || '...' else new.comentario end || '"',
                v_isbn,
                new.id_resena
            );
        end if;
    end if;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_on_resena_respuesta on public.resena_respuestas;
create trigger tr_on_resena_respuesta
    after insert on public.resena_respuestas
    for each row execute function public.tr_notif_resena_respuesta();

-- 3. Trigger para LIKE en respuesta secundaria (comentario de comentario)
create or replace function public.tr_notif_respuesta_like()
returns trigger as $$
declare
    v_reply_user uuid;
    v_resena_id uuid;
    v_isbn text;
    v_titulo text;
    v_liker_name text;
begin
    select resp.id_usuario, resp.id_resena, r.isbn, coalesce(l.titulo, 'una obra'), coalesce(u.nombre_usuario, 'Un lector')
    into v_reply_user, v_resena_id, v_isbn, v_titulo, v_liker_name
    from public.resena_respuestas resp
    join public.resenas r on r.id_resena = resp.id_resena
    left join public.libros l on l.isbn = r.isbn
    left join public.usuario u on u.id_usuario = new.id_usuario
    where resp.id_respuesta = new.id_respuesta;

    if v_reply_user is not null and v_reply_user <> new.id_usuario then
        if not exists (
            select 1 from public.notificaciones
            where id_usuario = v_reply_user
              and tipo = 'like'
              and id_resena = v_resena_id
              and creado_el >= now() - interval '1 minute'
        ) then
            insert into public.notificaciones (id_usuario, tipo, titulo, mensaje, isbn, id_resena)
            values (
                v_reply_user,
                'like',
                'Nuevo me gusta en tu comentario',
                'A @' || lower(replace(v_liker_name, ' ', '_')) || ' le gustó tu comentario en "' || v_titulo || '".',
                v_isbn,
                v_resena_id
            );
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_on_respuesta_like on public.respuesta_likes;
create trigger tr_on_respuesta_like
    after insert on public.respuesta_likes
    for each row execute function public.tr_notif_respuesta_like();

-- Habilitar réplica en tiempo real (Supabase Realtime) para la tabla de notificaciones
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table public.notificaciones;
    end if;
exception
    when duplicate_object then null;
end;
$$;
