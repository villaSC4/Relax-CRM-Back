-- ============================================================
--  BASE DE DATOS: relax_crm_db
--  CRM RELAX by QMEDIC
-- ============================================================

CREATE DATABASE IF NOT EXISTS relax_crm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE relax_crm_db;

-- ------------------------------------------------------------
-- TABLA: clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  full_name    VARCHAR(150) NOT NULL,
  phone        VARCHAR(20)  NOT NULL UNIQUE,
  email        VARCHAR(150) NULL,
  notes        TEXT         NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TABLA: services (9 experiencias RELAX, 50 o 80 min)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  description      TEXT         NULL,
  duration_minutes INT          NOT NULL,
  price            DECIMAL(8,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO services (name, description, duration_minutes, price) VALUES
  ('Dream Relax',              'Masaje de cuerpo completo con maniobras suaves para aliviar la tension, desconectar la mente y renovar el bienestar.',                                         50,  120.00),
  ('Dream Relax',              'Masaje de cuerpo completo con maniobras suaves para aliviar la tension, desconectar la mente y renovar el bienestar.',                                         80,  150.00),
  ('Relax Reset',              'Masaje revitalizante con maniobras profundas y reflexologia podal, para aliviar el cansancio y devolver sensacion de ligereza.',                               50,  120.00),
  ('Total Reset',              'Masaje relajante de cuerpo completo con reflexologia podal para liberar tensiones, restaurar el equilibrio y generar calma.',                                   50,  120.00),
  ('Total Reset',              'Masaje relajante de cuerpo completo con reflexologia podal para liberar tensiones, restaurar el equilibrio y generar calma.',                                   80,  150.00),
  ('Masaje Descontracturante', 'Experiencia de intensidad profunda que combina masajes especializados y herramientas terapeuticas para liberar contracturas.',                                  50,  120.00),
  ('Masaje Descontracturante', 'Experiencia de intensidad profunda que combina masajes especializados y herramientas terapeuticas para liberar contracturas.',                                  80,  150.00),
  ('Descontracturante Superior','Experiencia enfocada en cuello, hombros, espalda y brazos con masajes descontracturantes y herramientas terapeuticas especializadas.',                        50,  120.00),
  ('Descontracturante Superior','Experiencia enfocada en cuello, hombros, espalda y brazos con masajes descontracturantes y herramientas terapeuticas especializadas.',                        80,  150.00),
  ('Descontracturante Inferior','Trabaja zona lumbar, piernas, pantorrillas y pies mediante masajes descontracturantes, herramientas especializadas y reflexologia podal.',                    50,  120.00),
  ('Descontracturante Inferior','Trabaja zona lumbar, piernas, pantorrillas y pies mediante masajes descontracturantes, herramientas especializadas y reflexologia podal.',                    80,  150.00),
  ('Detox Muscular',           'Combina tecnologia V-Conic y masaje de drenaje detox para liberar tensiones, estimular la circulacion y generar ligereza.',                                   80,  150.00),
  ('Detox Muscular Superior',  'Combina tecnologia V-Conic y drenaje detox en cuello, hombros y espalda para eliminar toxinas, devolver ligereza y mejorar movilidad.',                       50,  120.00),
  ('Detox Muscular Superior',  'Combina tecnologia V-Conic y drenaje detox en cuello, hombros y espalda para eliminar toxinas, devolver ligereza y mejorar movilidad.',                       80,  150.00),
  ('Detox Muscular Inferior',  'Combina V-Conic y drenaje detox en zona lumbar, piernas, pantorrillas y pies para aliviar la fatiga y recuperar sensacion de ligereza.',                     50,  120.00),
  ('Detox Muscular Inferior',  'Combina V-Conic y drenaje detox en zona lumbar, piernas, pantorrillas y pies para aliviar la fatiga y recuperar sensacion de ligereza.',                     80,  150.00);

-- ------------------------------------------------------------
-- TABLA: appointments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT          NOT NULL,
  service_id      INT          NOT NULL,
  start_time      DATETIME     NOT NULL,
  end_time        DATETIME     NOT NULL,
  status          ENUM('PENDING','CONFIRMED','ATTENDED','CANCELLED') DEFAULT 'PENDING',
  price_paid      DECIMAL(8,2) NOT NULL,
  google_event_id VARCHAR(255) NULL,
  notes           TEXT         NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id)  REFERENCES clients(id)  ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TABLA: conversations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  client_id    INT          NOT NULL UNIQUE,
  last_message TEXT         NULL,
  unread_count INT          DEFAULT 0,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TABLA: messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT         NOT NULL,
  sender          ENUM('CLIENT','SYSTEM','RECEPTIONIST') NOT NULL,
  body            TEXT        NOT NULL,
  is_read         TINYINT(1)  DEFAULT 0,
  created_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TABLA: users (recepcionistas / admin del CRM RELAX)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('admin','recepcion') DEFAULT 'recepcion',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'Base de datos relax_crm_db creada exitosamente' AS resultado;
