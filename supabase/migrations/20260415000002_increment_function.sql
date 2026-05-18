-- Función para incrementar ejecuciones de forma segura
CREATE OR REPLACE FUNCTION incrementar_ejecuciones_auto(auto_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE automatizaciones
  SET ejecuciones = ejecuciones + 1
  WHERE id = auto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
