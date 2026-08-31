export function deliveryQuantityError(quantity: number, available: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) return "La cantidad debe ser mayor que cero.";
  if (quantity > available + 0.0001) return "La cantidad supera el saldo pendiente.";
  return null;
}
