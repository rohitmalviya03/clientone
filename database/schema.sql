CREATE DATABASE IF NOT EXISTS lab_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lab_portal;

CREATE TABLE IF NOT EXISTS tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  fasting_required TINYINT(1) NOT NULL DEFAULT 0,
  price_inr INT NOT NULL,
  display_order INT NOT NULL DEFAULT 100,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NOT NULL,
  city VARCHAR(90) NOT NULL,
  address VARCHAR(350) NOT NULL,
  collection_date DATE NOT NULL,
  collection_slot VARCHAR(40) NOT NULL,
  selected_tests VARCHAR(255) NULL,
  status ENUM('pending', 'assigned', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(140) NOT NULL,
  description VARCHAR(320) NOT NULL,
  tag VARCHAR(70) NOT NULL,
  display_order INT NOT NULL DEFAULT 100,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(90) NULL,
  message VARCHAR(400) NULL,
  preferred_date DATE NULL,
  status ENUM('new', 'in_progress', 'closed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_requests_service
    FOREIGN KEY (service_id) REFERENCES services(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  tests_count INT NOT NULL,
  ideal_for VARCHAR(220) NOT NULL,
  report_time VARCHAR(60) NOT NULL,
  original_price_inr INT NOT NULL,
  offer_price_inr INT NOT NULL,
  display_order INT NOT NULL DEFAULT 100,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tests (name, category, fasting_required, price_inr, display_order) VALUES
('Complete Blood Count (CBC)', 'Routine', 0, 420, 1),
('Lipid Profile', 'Heart Health', 1, 760, 2),
('Thyroid Profile (T3, T4, TSH)', 'Hormonal', 0, 690, 3),
('HbA1c', 'Diabetes', 0, 540, 4),
('Vitamin D (25-OH)', 'Vitamins', 0, 1190, 5),
('Kidney Function Test (KFT)', 'Organ Function', 0, 820, 6);

INSERT INTO services (title, description, tag, display_order) VALUES
('Certified Phlebotomists', 'Trained experts follow strict hygiene and sterile single-use collection protocols.', 'Safety', 1),
('Precise Turnaround Times', 'Priority processing with transparent updates from collection to report delivery.', 'Speed', 2),
('Secure Patient Data', 'Booking, payment, and reports are protected with role-based access controls.', 'Privacy', 3),
('Senior Citizen Home Care', 'Comfort-first collection workflow with dedicated assistance for elderly patients.', 'Care', 4),
('Corporate Health Camps', 'Bulk employee testing programs with scheduler support and consolidated reports.', 'Corporate', 5),
('Doctor Consultation Connect', 'Optional follow-up interpretation assistance after reports are generated.', 'Support', 6);

INSERT INTO packages (name, tests_count, ideal_for, report_time, original_price_inr, offer_price_inr, display_order) VALUES
('Swasth Basic Care', 45, 'Routine annual health screening', '24 hours', 1499, 999, 1),
('Swasth Heart Check', 62, 'Heart risk and lipid monitoring', '24 hours', 2199, 1599, 2),
('Swasth Diabetes Plus', 58, 'Sugar, HbA1c, kidney, liver tracking', '18 hours', 1999, 1399, 3),
('Swasth Senior Shield', 74, 'Senior citizen preventive profile', '24-36 hours', 2999, 2099, 4),
('Swasth Women Wellness', 68, 'Hormonal, thyroid, vitamin panel', '24 hours', 2699, 1899, 5),
('Swasth Full Body Advanced', 92, 'Comprehensive full body evaluation', '24-36 hours', 3999, 2799, 6);
