"use client";

// Último recurso quando o layout raiz falha. Sem detalhes técnicos.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <main>
          <h1>Algo deu errado</h1>
          <p>Tente novamente em instantes.</p>
          <button type="button" onClick={reset} style={{ minHeight: 44 }}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
