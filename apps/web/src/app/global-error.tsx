"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <main className="login-page">
          <section className="login-box">
            <h1>Error critico de la web</h1>
            <p>{error.message || "No fue posible iniciar la aplicacion."}</p>
            <button type="button" onClick={reset}>
              Reintentar
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
