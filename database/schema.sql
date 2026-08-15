CREATE TABLE IF NOT EXISTS mesas (
  id SMALLINT UNSIGNED NOT NULL,
  capacidad TINYINT UNSIGNED NOT NULL,
  zona VARCHAR(40) NOT NULL,
  estado ENUM('Activa', 'Mantenimiento') NOT NULL DEFAULT 'Activa',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservas (
  id CHAR(36) NOT NULL,
  cliente VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL DEFAULT '',
  telefono VARCHAR(40) NOT NULL DEFAULT '',
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  mesa_id SMALLINT UNSIGNED NOT NULL,
  personas TINYINT UNSIGNED NOT NULL,
  estado ENUM('Confirmada', 'Pendiente', 'Cancelada') NOT NULL DEFAULT 'Confirmada',
  origen VARCHAR(30) NOT NULL DEFAULT 'Web',
  notas VARCHAR(500) NOT NULL DEFAULT '',
  creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_reservas_mesa FOREIGN KEY (mesa_id) REFERENCES mesas(id),
  INDEX idx_reservas_fecha_hora (fecha, hora),
  INDEX idx_reservas_mesa (mesa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Esta tabla representa la ocupacion activa. Su llave primaria impide que dos
-- usuarios reserven la misma mesa, fecha y hora al mismo tiempo.
CREATE TABLE IF NOT EXISTS reservas_activas (
  mesa_id SMALLINT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  reserva_id CHAR(36) NOT NULL,
  PRIMARY KEY (mesa_id, fecha, hora),
  UNIQUE KEY uq_reserva_activa (reserva_id),
  CONSTRAINT fk_reservas_activas_mesa FOREIGN KEY (mesa_id) REFERENCES mesas(id),
  CONSTRAINT fk_reservas_activas_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO mesas (id, capacidad, zona, estado) VALUES
  (1, 2, 'Salon', 'Activa'),
  (2, 2, 'Salon', 'Activa'),
  (3, 4, 'Terraza', 'Activa'),
  (4, 4, 'Terraza', 'Activa'),
  (5, 6, 'Privado', 'Activa'),
  (6, 6, 'Salon', 'Activa'),
  (7, 8, 'Patio', 'Activa'),
  (8, 8, 'Patio', 'Mantenimiento');

-- Datos demostrativos que ya formaban parte del proyecto React original.
INSERT IGNORE INTO reservas
  (id, cliente, email, telefono, fecha, hora, mesa_id, personas, estado, origen, notas)
VALUES
  ('demo-1', 'Mariela Quispe', 'mariela@email.com', '987 451 220', '2026-07-05', '19:00:00', 3, 4, 'Confirmada', 'Web', 'Cumpleanos'),
  ('demo-2', 'Carlos Ramos', 'carlos@email.com', '912 334 098', '2026-07-06', '20:00:00', 5, 6, 'Pendiente', 'Telefono', 'Silla para nino'),
  ('demo-3', 'Lucia Torres', 'lucia@email.com', '955 120 030', '2026-07-09', '13:00:00', 1, 2, 'Confirmada', 'Web', '');

INSERT IGNORE INTO reservas_activas (mesa_id, fecha, hora, reserva_id) VALUES
  (3, '2026-07-05', '19:00:00', 'demo-1'),
  (5, '2026-07-06', '20:00:00', 'demo-2'),
  (1, '2026-07-09', '13:00:00', 'demo-3');
