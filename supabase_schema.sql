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
    total_paginas integer not null check (total_paginas > 0)
);

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
    id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
    motivo text not null,
    estado text not null default 'pendiente' check (estado in ('pendiente', 'descartado', 'atendido')),
    creado_el timestamptz default now(),
    revisado_el timestamptz
);

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
