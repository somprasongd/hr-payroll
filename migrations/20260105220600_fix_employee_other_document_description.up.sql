UPDATE employees e
SET id_document_other_description = 'ไม่ระบุ'
FROM id_document_type idt
WHERE e.id_document_type_id = idt.id
  AND idt.code = 'other'
  AND (e.id_document_other_description IS NULL OR e.id_document_other_description = '');
