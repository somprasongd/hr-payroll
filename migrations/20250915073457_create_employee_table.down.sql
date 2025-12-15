/* =======================================================
   Roll‑back script – Lookup tables, employees, triggers
   ======================================================= */

/* 1. Drop views (must be done before dropping tables) */
DROP VIEW IF EXISTS v_employees_active_enriched CASCADE;
DROP VIEW IF EXISTS v_employees_active CASCADE;

/* 2. Drop triggers on employees */
DROP TRIGGER IF EXISTS tg_employees_wage_validate ON employees;
DROP TRIGGER IF EXISTS tg_employees_set_updated ON employees;

/* 3. Drop trigger functions that were defined here */
DROP FUNCTION IF EXISTS employees_wage_validate() CASCADE;

/* 4. Drop indexes on employees (and lookup tables) */
DROP INDEX IF EXISTS employees_empno_active_uk;
DROP INDEX IF EXISTS employees_doc_idx;
DROP INDEX IF EXISTS employees_work_status_idx;
DROP INDEX IF EXISTS employees_department_idx;
DROP INDEX IF EXISTS employees_position_idx;
DROP INDEX IF EXISTS employees_not_deleted_idx;

/* 5. Drop lookup tables */
DROP TABLE IF EXISTS employee_photo CASCADE;
DROP TABLE IF EXISTS employee_position CASCADE;
DROP TABLE IF EXISTS department CASCADE;
DROP TABLE IF EXISTS employee_type CASCADE;
DROP TABLE IF EXISTS id_document_type CASCADE;
DROP TABLE IF EXISTS person_title CASCADE;

/* 6. Drop the main employees table */
DROP TABLE IF EXISTS employees CASCADE;
