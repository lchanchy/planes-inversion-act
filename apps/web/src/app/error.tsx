"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="login-page">
      <section className="login-box">
        <h1>Error de la aplicacion</h1>
        <p>{error.message || "No fue posible cargar la pantalla solicitada."}</p>
        <button type="button" onClick={reset}>
          Reintentar
        </button>
      </section>
    </main>
  );
}
