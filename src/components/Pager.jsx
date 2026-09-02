export default function Pager({ page, totalPages, total, onPrev, onNext, label = "registros" }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-secondary px-1">
      <span>
        Página {page + 1} de {totalPages}
        {typeof total === "number" ? ` · ${total} ${label}` : ""}
      </span>
      <div className="flex gap-2">
        <button type="button" disabled={page === 0} onClick={onPrev} className="btn-secondary px-3">
          Anterior
        </button>
        <button type="button" disabled={page >= totalPages - 1} onClick={onNext} className="btn-secondary px-3">
          Siguiente
        </button>
      </div>
    </div>
  );
}
