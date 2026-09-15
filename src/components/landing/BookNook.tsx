import type { ReactNode } from "react";

import "./book-nook.css";

export function BookNook({
  book,
  fascia,
}: {
  book: ReactNode;
  fascia?: ReactNode;
}) {
  return (
    <div className={`book-nook${fascia ? "" : " book-nook--compact"}`}>
      <div className="book-nook__wall">
        <div className="book-nook__glow" aria-hidden />
        <div className="book-nook__alcove">{book}</div>
        <div className="book-nook__shelf">
          <div className="book-nook__plank" aria-hidden />
          {fascia ? <div className="book-nook__fascia">{fascia}</div> : null}
        </div>
      </div>
    </div>
  );
}
