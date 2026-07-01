-- ============================================================
--  RUTINA JESSI (S4 M6) - esquema Supabase (lectura pública)
-- ============================================================

create table if not exists alumnas (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null
);

create table if not exists rutinas (
  id          uuid primary key default gen_random_uuid(),
  alumna_id   uuid references alumnas(id) on delete cascade,
  nombre      text not null,          -- Lunes, Miércoles, ...
  descripcion text,
  orden       int  default 0,
  archivada   boolean default false
);

create table if not exists ejercicios (
  id         uuid primary key default gen_random_uuid(),
  rutina_id  uuid references rutinas(id) on delete cascade,
  nombre     text not null,
  sets       int,
  reps       text,        -- texto: "12", "2 min", "32 pasos", "fallo", "12, 12, 10"
  peso       text,        -- texto: "55 kg", "85 lb", "nivel 18", "----"
  descanso   text,
  nota       text,
  imagen_url text,
  orden      int default 0
);

alter table alumnas    enable row level security;
alter table rutinas    enable row level security;
alter table ejercicios enable row level security;

create policy "lectura publica alumnas"    on alumnas    for select using (true);
create policy "lectura publica rutinas"    on rutinas    for select using (true);
create policy "lectura publica ejercicios" on ejercicios for select using (true);

-- Seed --------------------------------------------------------
do $$
declare
  v_alumna uuid; v_dia uuid;
begin
  insert into alumnas (nombre) values ('Jessi') returning id into v_alumna;

  -- ================= LUNES =================
  insert into rutinas (alumna_id, nombre, orden) values (v_alumna,'Lunes',1) returning id into v_dia;
  insert into ejercicios (rutina_id,nombre,sets,reps,peso,descanso,nota,orden) values
    (v_dia,'Estiramiento del piriforme sentado',3,'4','----',null,null,1),
    (v_dia,'Masaje en glúteo medio con pelotita',3,'2 min','----',null,null,2),
    (v_dia,'Máquina de abdomen',2,'12','nivel 18','1:00',null,3),
    (v_dia,'Hip Thrust',3,'8','55 kg','3:00','2 sets de 4 series con 54, 1 set fallo 45',4),
    (v_dia,'Patada de glúteo cruzada',2,'10','99','1:30','Por pierna',5),
    (v_dia,'Búlgaras tronco inclinado (aprox. 30°)',2,'9','15 kg','1:30','Por pierna',6),
    (v_dia,'Zancadas en movimiento',3,'32 pasos','20 kg','3:00',null,7),
    (v_dia,'Extensiones individuales',2,'11','45','1:30','Por pierna',8),
    (v_dia,'Aductores',3,'10','85 lb','1:30',null,9),
    (v_dia,'Pantorrilla en prensa recta',2,'12','175','1:30',null,10);

  -- ================= MIÉRCOLES =================
  insert into rutinas (alumna_id, nombre, orden) values (v_alumna,'Miércoles',2) returning id into v_dia;
  insert into ejercicios (rutina_id,nombre,sets,reps,peso,descanso,nota,orden) values
    (v_dia,'Rotación externa de hombro',3,'12',null,null,null,1),
    (v_dia,'Posición T Y',3,'12',null,null,null,2),
    (v_dia,'Máquina de abdomen',2,'13','nivel 18',null,null,3),
    (v_dia,'Curl femoral sentada',2,'8','85',null,null,4),
    (v_dia,'Elevaciones laterales sentada',3,'10','8 kg',null,null,5),
    (v_dia,'Remos en máquina',2,'10','35 kg x lado',null,'Inténtalas sin descanso',6),
    (v_dia,'Lat pull down',2,'8','88',null,'88-1 tab. Corrígeme este peso.',7),
    (v_dia,'Press inclinado',2,'7','15 kg',null,'Coméntame sensaciones',8),
    (v_dia,'Predicador en banco',2,'12','20',null,'Nos quedamos en el peso pero aumentamos set',9),
    (v_dia,'Extensiones de tríceps',2,'fallo','66',null,null,10);

  -- ================= VIERNES =================
  insert into rutinas (alumna_id, nombre, orden) values (v_alumna,'Viernes',3) returning id into v_dia;
  insert into ejercicios (rutina_id,nombre,sets,reps,peso,descanso,nota,orden) values
    (v_dia,'Estiramiento supino del piriforme',3,'5','----',null,null,1),
    (v_dia,'Estiramiento de los flexores',3,'15','----',null,null,2),
    (v_dia,'Máquina de abdomen',2,'14','nivel 18',null,null,3),
    (v_dia,'Puentes de glúteo con barra',3,'12, 12, 10','35 kg',null,'11, 11, set 9',4),
    (v_dia,'Peso muerto B-stand (pausa 2 s abajo)',2,'7','25 kg',null,'6 ya están difíciles, no sé cómo veas quedarnos aquí. Mantenerme 2 s está difícil. Coméntame cómo se siente la espalda baja los siguientes días.',5),
    (v_dia,'Abducción en máquina (glúteo)',2,'12','105',null,null,6),
    (v_dia,'Zancadas estáticas',1,'14','12.5 (mancuerna)',null,'Vi que habías puesto "lado", ¿quieres que use 12.5 por lado?',7),
    (v_dia,'Prensa',2,'13, 10','60 kg',null,null,8),
    (v_dia,'Aductores',2,'14','70',null,null,9),
    (v_dia,'Pantorrilla en prensa recta',2,'fallo','130 lb',null,null,10);

  -- ================= SÁBADO =================
  insert into rutinas (alumna_id, nombre, orden) values (v_alumna,'Sábado',4) returning id into v_dia;
  insert into ejercicios (rutina_id,nombre,sets,reps,peso,descanso,nota,orden) values
    (v_dia,'Estiramiento del piriforme sentado',3,'4','----',null,null,1),
    (v_dia,'Masaje en glúteo medio con pelotita',3,'2 min','----',null,null,2),
    (v_dia,'Máquina de abdomen',2,'15','nivel 18',null,null,3),
    (v_dia,'Curl femoral sentada',2,'9','90',null,null,4),
    (v_dia,'Elevaciones laterales sentada',2,'9','8 kg',null,'Ver nota (8)',5),
    (v_dia,'Press horizontal',2,'7, 5','70 lb',null,'Funciona',6),
    (v_dia,'Pec deck',2,'10, 8','35 lb',null,'Mejor',7),
    (v_dia,'Pull over',1,'11','77',null,'Ver nota (10)',8),
    (v_dia,'Remo bajo',1,'11','32.5 kg',null,'¿Podríamos cambiarlo a mancuerna? Una porque por más que acomode mi mano quedan como T-Rex, y dos porque al parecer estoy metiendo el trapecio.',9),
    (v_dia,'Extensiones horizontales',1,'12','55 lb',null,null,10),
    (v_dia,'Curl de bíceps en máquina',2,'12','55 lb',null,null,11);
end $$;
