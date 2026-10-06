-- Restricciones CHECK (reglas de negocio a nivel de base de datos)
ALTER TABLE tenders          ADD CONSTRAINT chk_max_budget_pos   CHECK (max_budget > 0);
ALTER TABLE tender_products  ADD CONSTRAINT chk_qty_pos          CHECK (quantity > 0);
ALTER TABLE tender_products  ADD CONSTRAINT chk_unit_price_nonneg CHECK (unit_price >= 0);
ALTER TABLE payments         ADD CONSTRAINT chk_payment_pos      CHECK (amount > 0);
ALTER TABLE products         ADD CONSTRAINT chk_base_price_nonneg CHECK (base_price >= 0);
